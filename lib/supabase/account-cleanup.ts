import { createAdminClient } from "@/lib/supabase/admin";

const BUCKETS = [
  "chat-attachments",
  "profile-media",
  "story-media",
] as const;

type AdminClient = ReturnType<typeof createAdminClient>;

async function listFiles(
  admin: AdminClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const files: string[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, {
        limit,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) throw error;
    if (!data?.length) break;

    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;

      if (entry.id === null) {
        files.push(
          ...(await listFiles(admin, bucket, path))
        );
      } else {
        files.push(path);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return files;
}

export async function inspectAccountStorage(
  admin: AdminClient,
  userId: string
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  ) {
    throw new Error("Invalid account identifier.");
  }

  const inventory: Record<string, string[]> = {};

  for (const bucket of BUCKETS) {
    inventory[bucket] = await listFiles(
      admin,
      bucket,
      userId
    );
  }

  return inventory;
}

export async function removeAccountStorage(
  admin: AdminClient,
  userId: string
) {
  const inventory = await inspectAccountStorage(
    admin,
    userId
  );

  let removed = 0;

  for (const bucket of BUCKETS) {
    const paths = inventory[bucket];

    for (const path of paths) {
      if (!path.startsWith(`${userId}/`)) {
        throw new Error("Unsafe storage path.");
      }
    }

    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);

      const { data, error } = await admin.storage
        .from(bucket)
        .remove(batch);

      if (error) throw error;

      removed += data?.length ?? 0;
    }
  }

  const remaining = await inspectAccountStorage(
    admin,
    userId
  );

  if (Object.values(remaining).some(files => files.length)) {
    throw new Error("Storage cleanup incomplete.");
  }

  return { removed };
}
