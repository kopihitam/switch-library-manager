// Remembers the order a user drags a table's columns into, keyed by column field.
// Columns without a field (such as the row-number column) keep their default position.

const STORAGE_PREFIX = "slm.columnOrder.";

// Accessing localStorage can throw when the webview blocks storage.
export function browserStorage() {
    try {
        return globalThis.localStorage || null;
    } catch (error) {
        console.warn("Browser storage is unavailable; column order will not be remembered", error);
        return null;
    }
}

export function readColumnOrder(storage, key) {
    let raw;
    try {
        raw = storage ? storage.getItem(STORAGE_PREFIX + key) : null;
    } catch (error) {
        console.warn("Could not read saved column order for " + key, error);
        return [];
    }
    if (!raw) {
        return [];
    }

    try {
        const fields = JSON.parse(raw);
        return Array.isArray(fields) && fields.every(field => typeof field === "string") ? fields : [];
    } catch (error) {
        console.warn("Ignoring malformed saved column order for " + key, error);
        return [];
    }
}

export function saveColumnOrder(storage, key, fields) {
    if (!storage) {
        return;
    }

    try {
        storage.setItem(STORAGE_PREFIX + key, JSON.stringify(fields));
    } catch (error) {
        console.warn("Could not save column order for " + key, error);
    }
}

// Reorders column definitions to match savedFields. Saved fields that no longer exist are
// ignored, and columns missing from the saved order follow the saved ones in default order.
export function applyColumnOrder(columns, savedFields) {
    const rank = new Map(savedFields.map((field, index) => [field, index]));
    const withField = columns.filter(column => column.field);
    const ordered = withField
        .filter(column => rank.has(column.field))
        .sort((a, b) => rank.get(a.field) - rank.get(b.field))
        .concat(withField.filter(column => !rank.has(column.field)));

    let next = 0;
    return columns.map(column => column.field ? ordered[next++] : column);
}

// Makes a table's columns movable and restores/saves their order under key.
export function rememberColumnOrder(options, key, storage) {
    const columnMoved = options.columnMoved;
    return Object.assign({}, options, {
        movableColumns: true,
        columns: applyColumnOrder(options.columns || [], readColumnOrder(storage, key)),
        columnMoved(column, columns) {
            saveColumnOrder(storage, key, columns.map(value => value.getField()).filter(Boolean));
            if (columnMoved) {
                columnMoved.call(this, column, columns);
            }
        }
    });
}
