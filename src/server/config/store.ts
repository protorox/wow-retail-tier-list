import { prisma } from "@/src/server/db/prisma";
import { appConfigSchema, defaultAppConfig, type AppConfig } from "@/src/server/config/app-config";

const APP_CONFIG_ID = 1;

export async function ensureAppConfig(): Promise<AppConfig> {
  const existing = await prisma.appConfig.findUnique({ where: { id: APP_CONFIG_ID } });
  if (!existing) {
    await prisma.appConfig.create({
      data: {
        id: APP_CONFIG_ID,
        configJson: defaultAppConfig
      }
    });

    return defaultAppConfig;
  }

  const parsed = appConfigSchema.safeParse(existing.configJson);
  if (parsed.success) {
    return parsed.data;
  }

  await prisma.appConfig.update({
    where: { id: APP_CONFIG_ID },
    data: { configJson: defaultAppConfig }
  });

  return defaultAppConfig;
}

export async function updateAppConfig(config: AppConfig): Promise<void> {
  await prisma.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    create: {
      id: APP_CONFIG_ID,
      configJson: config
    },
    update: {
      configJson: config
    }
  });
}

export async function getRawAppConfigJson(): Promise<unknown> {
  const config = await prisma.appConfig.findUnique({ where: { id: APP_CONFIG_ID } });
  return config?.configJson ?? defaultAppConfig;
}
