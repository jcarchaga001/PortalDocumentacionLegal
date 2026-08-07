function readDatabaseName(environmentName, fallback) {
  const value = process.env[environmentName]?.trim() || fallback;
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`${environmentName} contiene un nombre de base de datos no valido.`);
  }
  return `\`${value}\``;
}

export function getDatabaseNames() {
  return Object.freeze({
    people: readDatabaseName("DB_NAME", "dbpqiygwlvvnhg"),
    documents: readDatabaseName("DOCUMENT_DB_NAME", "dbaiupyjxopa5m"),
    providers: readDatabaseName("PROVIDER_DB_NAME", "dbTesoreriaDev"),
    humanResources: readDatabaseName("HR_DB_NAME", "dbDevRecursosHumanos"),
    risk: readDatabaseName("RISK_DB_NAME", "dbiptt95dt572b"),
  });
}
