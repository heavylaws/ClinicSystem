import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_DIR = dirname(__dirname);

// Default to bu_backup/bu.bak if not provided
const BAK_FILE_ARG = process.argv[2] || join(PROJECT_DIR, 'bu_backup', 'bu.bak');
const BAK_FILE = resolve(BAK_FILE_ARG);
const EXPORT_DIR = join(PROJECT_DIR, 'bu_backup', 'exported');
const CONTAINER_NAME = 'dermclinic-mssql-migration';
const SA_PASSWORD = 'MigrationPass123!';
const MSSQL_PORT = 1434;

// Utilities
const log = (msg: string) => console.log(`\x1b[34m[MIGRATE]\x1b[0m ${msg}`);
const success = (msg: string) => console.log(`\x1b[32m[✓]\x1b[0m ${msg}`);
const warn = (msg: string) => console.log(`\x1b[33m[!]\x1b[0m ${msg}`);
const error = (msg: string) => {
    console.error(`\x1b[31m[✗]\x1b[0m ${msg}`);
    process.exit(1);
};

function runSync(command: string, options: any = { stdio: 'pipe' }) {
    try {
        return execSync(command, { encoding: 'utf-8', ...options }).trim();
    } catch (e: any) {
        throw new Error(e.message || String(e));
    }
}

// ─── Validate ────────────────────────────────────────────────────────
if (!existsSync(BAK_FILE)) {
    error(`Backup file not found: ${BAK_FILE}`);
}

log(`Using backup file: ${BAK_FILE}`);

// ─── Step 1: Start SQL Server Container ──────────────────────────────
log("Starting temporary SQL Server container...");
try {
    runSync(`docker rm -f ${CONTAINER_NAME}`);
} catch (e) {
    // ignore
}

runSync(`docker run -d --name ${CONTAINER_NAME} -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=${SA_PASSWORD}" -e "MSSQL_PID=Express" -p ${MSSQL_PORT}:1433 -v "${BAK_FILE}:/var/backups/bu.bak:ro" kcollins/mssql:latest`);

log("Waiting for SQL Server to start (this takes ~15 seconds)...");
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15000); // Sleep for 15 seconds

let isReady = false;
for (let i = 1; i <= 30; i++) {
    try {
        runSync(`docker exec ${CONTAINER_NAME} /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${SA_PASSWORD}" -C -Q "SELECT 1"`);
        isReady = true;
        success("SQL Server is ready");
        break;
    } catch (e) {
        if (i === 30) {
            error("SQL Server failed to start within 90 seconds");
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
    }
}

// ─── Step 2: Discover database name & Restore ───────────────────────
log("Discovering database name from backup...");
let dbName = "dermclinic_legacy";
try {
    const headerOut = runSync(`docker exec ${CONTAINER_NAME} /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${SA_PASSWORD}" -C -Q "RESTORE HEADERONLY FROM DISK = '/var/backups/bu.bak'" -h -1 -s"|" -W`);
    const lines = headerOut.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 1) {
        dbName = lines[1].split('|')[0].trim() || dbName;
    }
} catch (e) {
    warn(`Could not auto-detect database name, using '${dbName}'`);
}

log(`Database name: ${dbName}`);

log("Getting logical file names...");
let dataFile = '';
let logFile = '';
try {
    const fileListOut = runSync(`docker exec ${CONTAINER_NAME} /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${SA_PASSWORD}" -C -Q "RESTORE FILELISTONLY FROM DISK = '/var/backups/bu.bak'" -h -1 -s"|" -W`);
    const lines = fileListOut.split('\n').filter(l => l.trim().length > 0 && !l.includes("rows affected"));

    for (const line of lines) {
        const parts = line.split('|');
        if (parts.length > 2) {
            const logicalName = parts[0].trim();
            const type = parts[2].trim();
            if (type === 'D' && !dataFile) dataFile = logicalName;
            if (type === 'L' && !logFile) logFile = logicalName;
        }
    }
} catch (e: any) {
    error(`Failed to get file names: ${e.message}`);
}

log(`Data file: ${dataFile}, Log file: ${logFile}`);

log("Restoring backup...");
try {
    runSync(`docker exec ${CONTAINER_NAME} /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${SA_PASSWORD}" -C -Q "RESTORE DATABASE [${dbName}] FROM DISK = '/var/backups/bu.bak' WITH MOVE '${dataFile}' TO '/var/opt/mssql/data/${dbName}.mdf', MOVE '${logFile}' TO '/var/opt/mssql/data/${dbName}_log.ldf', REPLACE"`);
    success(`Backup restored to: ${dbName}`);
} catch (e: any) {
    error(`Restore failed: ${e.message}`);
}

// ─── Step 3: List all tables ─────────────────────────────────────────
log("Listing tables...");
let tables: string[] = [];
try {
    const tablesOut = runSync(`docker exec ${CONTAINER_NAME} /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${SA_PASSWORD}" -d "${dbName}" -C -Q "SELECT '[' + TABLE_SCHEMA + '].[' + TABLE_NAME + ']' FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME" -h -1 -W`);
    tables = tablesOut.split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0 && !t.includes("rows affected"));
} catch (e: any) {
    error(`Failed to list tables: ${e.message}`);
}

console.log("");
log("Found tables:");
for (const table of tables) {
    try {
        const countOut = runSync(`docker exec ${CONTAINER_NAME} /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${SA_PASSWORD}" -d "${dbName}" -C -Q "SELECT COUNT(*) FROM ${table}" -h -1 -W`);
        const count = countOut.split('\n')[0].trim();
        console.log(`  \x1b[32m${table}\x1b[0m (${count} rows)`);
    } catch (e) {
        console.log(`  \x1b[32m${table}\x1b[0m (Error counting rows)`);
    }
}

// ─── Step 4: Export each table as JSON ───────────────────────────────
if (!existsSync(EXPORT_DIR)) {
    mkdirSync(EXPORT_DIR, { recursive: true });
}

log("Exporting tables to JSON...");
for (const table of tables) {
    // Remove brackets: [dbo].[Patients] -> Patients
    const cleanTableName = table.replace(/\[/g, '').replace(/\]/g, '').replace(/^dbo\./, '');
    const outputFile = join(EXPORT_DIR, `${cleanTableName}.json`);
    const tempFile = join(EXPORT_DIR, `${cleanTableName}.json.tmp`);

    log(`  Exporting ${cleanTableName}...`);
    try {
        // Use BCP
        runSync(`docker exec ${CONTAINER_NAME} /opt/mssql-tools18/bin/bcp "SELECT * FROM ${table} FOR JSON AUTO" queryout "/tmp/${cleanTableName}.json" -S localhost -U sa -P "${SA_PASSWORD}" -c -C 65001 -d "${dbName}" -u`);

        // Copy to host
        runSync(`docker cp "${CONTAINER_NAME}:/tmp/${cleanTableName}.json" "${tempFile}"`);

        // Strip newlines
        let content = readFileSync(tempFile, 'utf-8');
        content = content.replace(/[\r\n]+/g, '');
        writeFileSync(outputFile, content);

        // Remove tmp
        runSync(`rm "${tempFile}"`); // Can fail on windows if we literally spawn rm. Use fs instead.
    } catch (e) {
        // Ignore clean up errors
    } finally {
        if (existsSync(tempFile)) {
            try { import('fs').then(fs => fs.unlinkSync(tempFile)); } catch (e) { }
        }
    }

    if (existsSync(outputFile)) {
        try {
            const content = readFileSync(outputFile, 'utf-8');
            if (content.length > 0) {
                const parsed = JSON.parse(content);
                success(`  ${cleanTableName} → exported (${parsed.length} rows)`);
            } else {
                warn(`  ${cleanTableName} → empty`);
                try { import('fs').then(fs => fs.unlinkSync(outputFile)); } catch (e) { }
            }
        } catch (e) {
            warn(`  ${cleanTableName} → invalid JSON`);
            try { import('fs').then(fs => fs.unlinkSync(outputFile)); } catch (e) { }
        }
    }
}

// ─── Step 5: Export schema info ──────────────────────────────────────
log("Exporting column info...");
try {
    runSync(`docker exec ${CONTAINER_NAME} /opt/mssql-tools18/bin/bcp "SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_NAME, ORDINAL_POSITION FOR JSON AUTO" queryout "/tmp/_schema.json" -S localhost -U sa -P "${SA_PASSWORD}" -c -C 65001 -d "${dbName}" -u`);

    const schemaTemp = join(EXPORT_DIR, '_schema.json.tmp');
    const schemaFile = join(EXPORT_DIR, '_schema.json');
    runSync(`docker cp "${CONTAINER_NAME}:/tmp/_schema.json" "${schemaTemp}"`);

    let content = readFileSync(schemaTemp, 'utf-8');
    content = content.replace(/[\r\n]+/g, '');
    writeFileSync(schemaFile, content);

    import('fs').then(fs => fs.unlinkSync(schemaTemp));
    success(`Schema exported to ${schemaFile}`);
} catch (e: any) {
    warn(`Failed to export schema: ${e.message}`);
}

// ─── Step 6: Cleanup ────────────────────────────────────────────────
log("Cleaning up SQL Server container...");
try {
    runSync(`docker rm -f ${CONTAINER_NAME}`);
} catch (e) {
    // ignore
}

console.log("");
success("════════════════════════════════════════════════════════");
success("  Migration complete!");
success("════════════════════════════════════════════════════════");
console.log("");
log(`Exported JSON files are preserved at: ${EXPORT_DIR}`);

// ─── Step 7: Run Node.js loader ──────────────────────────────────────
log("Loading data into PostgreSQL...");
try {
    // We use spawnSync directly to pipe stdio cleanly to the parent process
    const loaderScript = join(PROJECT_DIR, 'scripts', 'load-legacy-data.ts');
    spawnSync("npx", ["tsx", loaderScript, EXPORT_DIR], { stdio: 'inherit', shell: true });
} catch (e: any) {
    error(`Failed to load data: ${e.message}`);
}
