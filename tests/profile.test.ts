import { it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as access from "@/server/access";
import * as database from "@/server/db";
import { user } from "@/server/schema";
import { codenameKey } from "@/server/validation";
import { PATCH } from "@/app/api/v1/me/route";

it("locks concurrent first codename claims while permitting retries and rejecting another player's name", async () => {
  const store = await database.createStore(process.env.TEST_DATABASE_URL, true);
  try {
    await store.migrate();
    const viewer = { id: randomUUID(), email: "profile@example.test", codename: null, emailVerified: true, role: "participant" as const, twoFactorEnabled: false };
    const other = { ...viewer, id: randomUUID(), email: "other-profile@example.test" };
    await store.db.insert(user).values([viewer, other].map(identity => ({ ...identity, name: "Private profile test" })));
    vi.spyOn(database, "getDb").mockResolvedValue(store.db);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("APP_URL", "http://localhost:3000");
    let arrivals = 0;
    let release!: () => void;
    const bothStarted = new Promise<void>(resolve => { release = resolve; });
    const identity = vi.spyOn(access, "requireAccess").mockImplementation(async () => {
      if (++arrivals === 2) release();
      await bothStarted;
      return { user: { ...viewer }, session: { id: "profile-session" } };
    });
    const claim = (codename: string) => PATCH(new Request("http://localhost:3000/api/v1/me", {
      method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ codename }),
    }), {});
    const names = ["first_profile", "second_profile"];
    const results = await Promise.all(names.map(claim));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const winner = names[results.findIndex(result => result.status === 200)];
    expect(await results.find(result => result.status === 409)!.json()).toMatchObject({ error: { code: "CODENAME_LOCKED" } });
    identity.mockResolvedValue({ user: { ...viewer }, session: { id: "profile-session" } });
    expect((await claim(winner)).status).toBe(200);
    const [stored] = await store.db.select().from(user).where(eq(user.id, viewer.id));
    expect(stored).toMatchObject({ codename: winner, codenameKey: codenameKey(winner) });
    identity.mockResolvedValue({ user: other, session: { id: "other-session" } });
    const collision = await claim(winner);
    expect(collision.status).toBe(409);
    expect(await collision.json()).toMatchObject({ error: { code: "CODENAME_TAKEN" } });
  } finally {
    vi.restoreAllMocks(); vi.unstubAllEnvs();
    await store.close();
  }
});

it("returns a conflict when two players concurrently claim the same available codename", async () => {
  const store = await database.createStore(process.env.TEST_DATABASE_URL, true);
  try {
    await store.migrate();
    const contenders = [randomUUID(), randomUUID()].map(id => ({ id, email: `${id}@example.test`, codename: null, emailVerified: true, role: "participant" as const, twoFactorEnabled: false }));
    await store.db.insert(user).values(contenders.map(identity => ({ ...identity, name: "Private profile race test" })));
    vi.spyOn(database, "getDb").mockResolvedValue(store.db);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("APP_URL", "http://localhost:3000");
    let actor = 0;
    vi.spyOn(access, "requireAccess").mockImplementation(async () => ({ user: contenders[actor++], session: { id: "profile-race-session" } }));
    // Both requests can pass the availability check before either update commits.
    const availability = vi.spyOn(store.db, "select").mockReturnValue({ from: () => ({ where: async () => [] }) } as never);
    const claim = () => PATCH(new Request("http://localhost:3000/api/v1/me", {
      method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ codename: "contested_profile" }),
    }), {});
    const results = await Promise.all([claim(), claim()]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(await results.find(result => result.status === 409)!.json()).toMatchObject({ error: { code: "CONFLICT" } });
    availability.mockRestore();
    const owners = await store.db.select({ id: user.id }).from(user).where(eq(user.codenameKey, codenameKey("contested_profile")));
    expect(owners).toHaveLength(1);
    expect(owners[0].id).toBe(contenders[results.findIndex(result => result.status === 200)].id);
  } finally {
    vi.restoreAllMocks(); vi.unstubAllEnvs();
    await store.close();
  }
});
