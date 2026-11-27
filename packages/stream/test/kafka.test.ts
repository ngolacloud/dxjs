import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import { kafkaSource, kafkaFeed, type KafkaRecord } from "../src/kafka.ts";
import type { StreamSource, StreamController } from "../src/sources.ts";

const micro = (): Promise<void> => new Promise((r) => queueMicrotask(r));
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function manualSource<T>() {
  let sink: (item: T) => void = () => {};
  let controller: StreamController = { error() {}, done() {} };
  const src: StreamSource<T> = {
    subscribe(s, c) {
      sink = s;
      controller = c;
      return () => {};
    },
  };
  return { src, push: (i: T): void => sink(i), done: (): void => controller.done() };
}

const rec = <V>(partition: number, offset: number, key: string | null, value: V): KafkaRecord<V> => ({
  topic: "t",
  partition,
  offset,
  key,
  value,
});

test("kafkaFeed coalesces by partition:offset, orders by offset, and windows", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<KafkaRecord<string>>();
    const feed = kafkaFeed<string>({ source: m.src, window: 3 });
    m.push(rec(0, 10, null, "a"));
    m.push(rec(0, 11, null, "b"));
    m.push(rec(0, 11, null, "b2")); // same partition:offset -> last-write-wins
    m.push(rec(0, 12, null, "c"));
    m.push(rec(0, 13, null, "d"));
    await micro();

    const vals = feed.items().map((r) => r.value);
    // offsets 10,11(->b2),12,13 => 4 entries; window 3 drops oldest offset 10
    assert.deepEqual(vals, ["b2", "c", "d"]);
    assert.equal(feed.dropped(), 1);
    dispose();
  });
});

test("kafkaFeed keeps offset order regardless of arrival order", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<KafkaRecord<number>>();
    const feed = kafkaFeed<number>({ source: m.src });
    m.push(rec(0, 3, null, 30));
    m.push(rec(0, 1, null, 10));
    m.push(rec(0, 2, null, 20));
    await micro();
    assert.deepEqual(
      feed.items().map((r) => r.offset),
      [1, 2, 3],
    );
    dispose();
  });
});

test("kafkaFeed coalesces by record key when present (latest value wins)", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<KafkaRecord<number>>();
    const feed = kafkaFeed<number>({ source: m.src });
    m.push(rec(0, 1, "user-7", 100));
    m.push(rec(0, 2, "user-7", 200)); // same key -> coalesce to latest
    await micro();
    const rows = feed.items();
    assert.equal(rows.length, 1, "same key collapsed");
    assert.equal(rows[0]!.value, 200);
    assert.equal(rows[0]!.offset, 2);
    dispose();
  });
});

test("kafkaSource wraps an async iterable; feed drains to completion", async () => {
  async function* recs(): AsyncGenerator<KafkaRecord<number>> {
    yield rec(0, 1, "x", 10);
    yield rec(0, 2, "y", 20);
    yield rec(0, 3, "x", 30); // same key as the first -> coalesce
  }
  await createRoot(async (dispose) => {
    const feed = kafkaFeed<number>({ source: kafkaSource(recs()) });
    await tick();
    const rows = feed.items();
    assert.equal(rows.length, 2, "keys x,y");
    assert.deepEqual(
      rows.map((r) => [r.key, r.value]),
      [
        ["y", 20],
        ["x", 30],
      ],
      "ordered by offset: y(2) then x(latest offset 3)",
    );
    dispose();
  });
});
