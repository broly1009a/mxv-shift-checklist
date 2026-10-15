import LayoutModel from "../models/layout.model";
import { SetLayoutDto } from "./dto/layout.dto";
import { cacheDB } from "../utils/redis.util";
import { REDIS_KEYS } from "../constants/redisKey.constant";

export async function setLayout(layoutDto: SetLayoutDto) {
  if (layoutDto.default === true) {
    await LayoutModel.updateMany(
      { default: true },
      { default: false }
    );
  }

  await LayoutModel.findOneAndUpdate(
    {
      user: layoutDto.user,
    },
    {
      $set: {
        user: layoutDto.user,
        value: JSON.stringify(layoutDto.value),
        default: layoutDto.default || false,
      },
    },
    {
      upsert: true,
    }
  );

  const formatKey = REDIS_KEYS.LAYOUT(layoutDto.user);
  await cacheDB.set(formatKey, layoutDto.value);

  return layoutDto.value;
}

export async function getLayout(user: string) {
  const formatKey = REDIS_KEYS.LAYOUT(user);
  const layoutCache = await cacheDB.get(formatKey);

  if (layoutCache && Object.keys(layoutCache).length > 0) {
    return layoutCache;
  }

  let layout: any = await LayoutModel.findOne({ user: user });
  if (layout && layout.value) {
    try {
      return JSON.parse(layout.value);
    } catch (e) {
      return layout.value;
    }
  }

  layout = await LayoutModel.findOne({ default: true });
  if (layout && layout.value) {
    try {
      return JSON.parse(layout.value);
    } catch (e) {
      return layout.value;
    }
  }

  return {};
}
