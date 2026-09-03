import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TaskData {
  title: string;
  content: string;
  source: string;
  assignedDate: string;
  assignedBy: string;
  documentNumber?: string;
  coordinatingUnits?: string;
  requiredCompletionDate?: string;
  actualCompletionDate?: string;
  completionEvidence?: string;
  incompleteReason?: string;
}

function parseCSV(csvContent: string): TaskData[] {
  const tasks: TaskData[] = [];
  
  // First, merge multiline fields (fields with newlines inside quotes)
  const mergedLines = mergeMultilineCSV(csvContent);
  
  // Skip header line
  const startIndex = mergedLines[0].includes('Tiêu đề') ? 1 : 0;

  for (let i = startIndex; i < mergedLines.length; i++) {
    const line = mergedLines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 5) continue;

    const task: TaskData = {
      title: cleanText(fields[0]?.replace(/^"|"$/g, '') || ''),
      content: cleanText(fields[1]?.replace(/^"|"$/g, '') || ''),
      source: cleanText(fields[2]?.replace(/^"|"$/g, '') || ''),
      assignedDate: cleanText(fields[3]?.replace(/^"|"$/g, '') || ''),
      assignedBy: cleanText(fields[4]?.replace(/^"|"$/g, '') || ''),
      documentNumber: cleanText(fields[5]?.replace(/^"|"$/g, '') || '') || undefined,
      coordinatingUnits: cleanText(fields[6]?.replace(/^"|"$/g, '') || '') || undefined,
      requiredCompletionDate: cleanText(fields[7]?.replace(/^"|"$/g, '') || '') || undefined,
      actualCompletionDate: cleanText(fields[8]?.replace(/^"|"$/g, '') || '') || undefined,
      completionEvidence: cleanText(fields[10]?.replace(/^"|"$/g, '') || '') || undefined,
      incompleteReason: cleanText(fields[11]?.replace(/^"|"$/g, '') || '') || undefined,
    };

    if (task.title) {
      tasks.push(task);
    }
  }

  return tasks;
}

function mergeMultilineCSV(csvContent: string): string[] {
  const lines = csvContent.split('\n');
  const mergedLines: string[] = [];
  let currentLine = '';
  let quoteCount = 0;

  for (const line of lines) {
    // Count quotes in current accumulated line
    let lineQuoteCount = 0;
    for (const c of line) {
      if (c === '"') lineQuoteCount++;
    }
    
    if (currentLine === '') {
      currentLine = line;
      quoteCount = lineQuoteCount;
    } else {
      // Append to current line (multiline field)
      currentLine += '\n' + line;
      quoteCount += lineQuoteCount;
    }

    // If quote count is even, we have a complete record
    if (quoteCount % 2 === 0) {
      mergedLines.push(currentLine);
      currentLine = '';
      quoteCount = 0;
    }
  }

  // Add any remaining content
  if (currentLine.trim()) {
    mergedLines.push(currentLine);
  }

  return mergedLines;
}

function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n')    // Normalize line endings
    .trim();
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function parseVietnameseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Format: DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  
  return null;
}

// Convert Roman numerals to Arabic numbers
function romanToArabic(str: string): string {
  const romanMap: { [key: string]: string } = {
    'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
    'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
  };
  
  let result = str;
  // Sort by length (longest first) to avoid partial matches
  const sortedRomans = Object.keys(romanMap).sort((a, b) => b.length - a.length);
  
  for (const roman of sortedRomans) {
    result = result.replace(new RegExp(roman, 'g'), romanMap[roman]);
  }
  
  return result;
}

// Normalize department name for matching
function normalizeDeptName(name: string): string {
  return romanToArabic(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[, &\-]/g, '');
}

async function main() {
  console.log('🌱 Starting seed tasks...');

  // Get department name from command line args
  const deptName = process.argv[2];
  if (!deptName) {
    console.error('❌ Please provide department name!');
    console.log('Usage: npx ts-node prisma/seed-tasks.ts "Phòng Tổ chức cán bộ"');
    return;
  }

  // Read CSV file
  const csvFileName = deptName.replace(/\s+/g, '').replace(/[àáạảã]/g, 'a').replace(/[ăắằẳẵ]/g, 'a').replace(/[âấầẩẫ]/g, 'a').replace(/[đ]/g, 'd').replace(/[èéẹẻẽ]/g, 'e').replace(/[êếềểễ]/g, 'e').replace(/[ìíịỉĩ]/g, 'i').replace(/[òóọỏõ]/g, 'o').replace(/[ôốồổỗ]/g, 'o').replace(/[ơớờởỡ]/g, 'o').replace(/[ùúụủũ]/g, 'u').replace(/[ưứừửữ]/g, 'u').replace(/[ỳýỵỷỹ]/g, 'y').replace(/[A-Z]/g, (c) => c);
  
  // Normalize Vietnamese characters
  function removeDiacritics(str: string) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  // Alias mapping for abbreviated department names
  const aliases: { [key: string]: string } = {
    'trungtamktcndbphiabac': 'trungtamktcnduongbophiabac',
    'trungtamktcndbphianam': 'trungtamktcnduongbophianam',
    'khuql1': 'khuquanlyduongbo1',
    'khuql2': 'khuquanlyduongbo2',
    'khuql3': 'khuquanlyduongbo3',
    'khuql4': 'khuquanlyduongbo4',
  };

  // Try to find CSV file with various name patterns
  const deptNameNormalized = normalizeDeptName(deptName);
  
  // Also list all CSV files in data directory
  const dataDir = path.join(__dirname, 'data');
  const allCsvFiles = fs.existsSync(dataDir) 
    ? fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'))
    : [];
  
  let csvPath = '';
  
  // Try fuzzy match with normalized names and aliases
  for (const file of allCsvFiles) {
    const fileNameNormalized = normalizeDeptName(file.replace('.csv', ''));
    const deptNormalized = aliases[deptNameNormalized] || deptNameNormalized;
    if (fileNameNormalized.includes(deptNormalized) || deptNormalized.includes(fileNameNormalized)) {
      csvPath = path.join(__dirname, 'data', file);
      break;
    }
  }
  
  if (!csvPath) {
    console.error(`❌ CSV file not found for department: ${deptName}`);
    console.log('📁 Available CSV files:');
    allCsvFiles.forEach(f => console.log(`   - ${f}`));
    return;
  }

  console.log(`📂 Reading from: ${csvPath}`);

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const tasks = parseCSV(csvContent);

  console.log(`📋 Found ${tasks.length} tasks to import`);

  // Find department
  const department = await prisma.department.findFirst({
    where: { name: deptName }
  });

  if (!department) {
    console.error(`❌ Department "${deptName}" not found!`);
    console.log('📁 Available departments:');
    const allDepts = await prisma.department.findMany({ select: { name: true } });
    allDepts.forEach(d => console.log(`   - ${d.name}`));
    return;
  }

  console.log(`🏛️  Using department: ${department.name} (${department.id})`);

  // Find an admin user as createdBy (temporary)
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: 'ADMIN' } }
  });

  if (!adminUser) {
    console.error('❌ No admin user found! Please create an admin user first.');
    return;
  }

  // Import tasks
  let imported = 0;
  let skipped = 0;

  for (const taskData of tasks) {
    try {
      // Check if task already exists (by title + assignedDate)
      const existing = await prisma.task.findFirst({
        where: {
          title: taskData.title,
          assignedDate: parseVietnameseDate(taskData.assignedDate) || new Date(),
          ownerDepartmentId: department.id,
        }
      });

      if (existing) {
        console.log(`⏭️  Skipping duplicate: ${taskData.title.substring(0, 50)}...`);
        skipped++;
        continue;
      }

      const assignedDate = parseVietnameseDate(taskData.assignedDate) || new Date();
      const requiredCompletionDate = parseVietnameseDate(taskData.requiredCompletionDate || '');
      const actualCompletionDate = parseVietnameseDate(taskData.actualCompletionDate || '');

      // Validate dates (only when assignedDate exists in CSV)
      if (taskData.assignedDate && requiredCompletionDate && requiredCompletionDate < assignedDate) {
        console.log(`⚠️  Invalid date range for: ${taskData.title.substring(0, 50)}...`);
        skipped++;
        continue;
      }

      const taskCode = `NV-${Date.now()}-${imported}`;

      await prisma.task.create({
        data: {
          taskCode,
          title: taskData.title,
          content: taskData.content || taskData.title,
          source: taskData.source,
          assignedDate,
          assignedBy: taskData.assignedBy,
          documentNumber: taskData.documentNumber || null,
          coordinatingUnits: taskData.coordinatingUnits || null,
          ownerDepartmentId: department.id,
          requiredCompletionDate,
          actualCompletionDate,
          completionEvidence: taskData.completionEvidence || null,
          incompleteReason: taskData.incompleteReason || null,
          createdBy: adminUser.id,
        }
      });

      console.log(`✅ Imported: ${taskData.title.substring(0, 50)}...`);
      imported++;
    } catch (error) {
      console.error(`❌ Error importing task: ${taskData.title.substring(0, 50)}...`);
      console.error(error);
      skipped++;
    }
  }

  console.log('\n📊 Seed completed!');
  console.log(`   ✅ Imported: ${imported} tasks`);
  console.log(`   ⏭️  Skipped: ${skipped} tasks`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
