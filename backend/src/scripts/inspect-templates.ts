import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { ChecklistTemplate } from '../schemas/template.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const templateModel = app.get<any>(getModelToken(ChecklistTemplate.name));

  const templates = await templateModel.find().populate('departmentId').exec();
  console.log(`Total templates found in DB: ${templates.length}`);
  
  for (const t of templates) {
    console.log(`- Template: "${t.title}"`);
    console.log(`  ID: ${t._id}`);
    console.log(`  isActive: ${t.isActive}`);
    console.log(`  sessionType: ${t.sessionType}`);
    console.log(`  department: ${t.departmentId?.name} (Code: ${t.departmentId?.code})`);
    console.log(`  tasks count: ${t.tasks?.length || 0}`);
  }

  await app.close();
}

run().catch(console.error);
