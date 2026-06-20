import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShiftSlot } from '../../schemas/shift-slot.schema';

@Injectable()
export class ShiftSlotsService {
  constructor(
    @InjectModel(ShiftSlot.name)
    private readonly shiftSlotModel: Model<ShiftSlot>,
  ) {}

  async findAll(): Promise<ShiftSlot[]> {
    return this.shiftSlotModel.find().sort({ sortOrder: 1 }).exec();
  }

  async findOne(id: string): Promise<ShiftSlot> {
    const slot = await this.shiftSlotModel.findById(id).exec();
    if (!slot) {
      throw new NotFoundException(`Shift slot with ID ${id} not found`);
    }
    return slot;
  }

  async findByCode(code: string): Promise<ShiftSlot | null> {
    return this.shiftSlotModel.findOne({ code }).exec();
  }

  async create(data: any): Promise<ShiftSlot> {
    const existing = await this.shiftSlotModel
      .findOne({ code: data.code })
      .exec();
    if (existing) {
      throw new ConflictException(
        `Shift slot code ${data.code} already exists`,
      );
    }
    const newSlot = new this.shiftSlotModel(data);
    return newSlot.save();
  }

  async update(id: string, data: any): Promise<ShiftSlot> {
    if (data.code) {
      const existing = await this.shiftSlotModel
        .findOne({ code: data.code, _id: { $ne: id } })
        .exec();
      if (existing) {
        throw new ConflictException(
          `Shift slot code ${data.code} already exists`,
        );
      }
    }
    const updated = await this.shiftSlotModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Shift slot with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<any> {
    const deleted = await this.shiftSlotModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Shift slot with ID ${id} not found`);
    }
    return { deleted: true };
  }
}
