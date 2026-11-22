import assert from "node:assert/strict";
import test from "node:test";
import {applyColumnOrder, readColumnOrder, rememberColumnOrder, saveColumnOrder} from "../frontend/column_order.js";

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        values
    };
}

const rownum = {formatter: "rownum", download: false};
const columns = () => [
    rownum,
    {title: "Missing DLC", field: "dlc.name"},
    {title: "DLC ID", field: "dlc.id"},
    {title: "Title", field: "game.name"},
    {title: "Title ID", field: "game.id"}
];
const fields = value => value.map(column => column.field ?? "#");

test("saved order is applied while unfielded columns keep their position", () => {
    const ordered = applyColumnOrder(columns(), ["game.name", "dlc.name", "game.id", "dlc.id"]);
    assert.deepEqual(fields(ordered), ["#", "game.name", "dlc.name", "game.id", "dlc.id"]);
    assert.equal(ordered[0], rownum);
});

test("stale saved fields are ignored and new columns follow saved ones", () => {
    const ordered = applyColumnOrder(columns(), ["removed", "game.id", "dlc.name"]);
    assert.deepEqual(fields(ordered), ["#", "game.id", "dlc.name", "dlc.id", "game.name"]);
    assert.deepEqual(fields(applyColumnOrder(columns(), [])), fields(columns()));
});

test("malformed or unavailable storage falls back to the default order", () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
        assert.deepEqual(readColumnOrder(memoryStorage({"slm.columnOrder.t": "{not json"}), "t"), []);
        assert.deepEqual(readColumnOrder(memoryStorage({"slm.columnOrder.t": '{"a":1}'}), "t"), []);
        assert.deepEqual(readColumnOrder(memoryStorage({"slm.columnOrder.t": '["a",2]'}), "t"), []);
        assert.deepEqual(readColumnOrder(null, "t"), []);
        assert.deepEqual(readColumnOrder({getItem() { throw new Error("blocked"); }}, "t"), []);
        saveColumnOrder({setItem() { throw new Error("quota"); }}, "t", ["a"]);
        saveColumnOrder(null, "t", ["a"]);
    } finally {
        console.warn = warn;
    }
});

test("moving a column saves the new order and restores it on the next table", () => {
    const storage = memoryStorage();
    let previousCallback = 0;
    const options = rememberColumnOrder({layout: "fitDataStretch", columns: columns(), columnMoved() { previousCallback++; }}, "missing_dlc", storage);
    assert.equal(options.movableColumns, true);
    assert.equal(options.layout, "fitDataStretch");
    assert.deepEqual(fields(options.columns), fields(columns()));

    const component = field => ({getField: () => field});
    options.columnMoved(component("game.name"), [undefined, "game.name", "dlc.name", "dlc.id", "game.id"].map(component));
    assert.equal(previousCallback, 1);
    assert.equal(storage.values.get("slm.columnOrder.missing_dlc"), '["game.name","dlc.name","dlc.id","game.id"]');

    const restored = rememberColumnOrder({columns: columns()}, "missing_dlc", storage);
    assert.deepEqual(fields(restored.columns), ["#", "game.name", "dlc.name", "dlc.id", "game.id"]);
    assert.deepEqual(fields(rememberColumnOrder({columns: columns()}, "other_table", storage).columns), fields(columns()));
});
