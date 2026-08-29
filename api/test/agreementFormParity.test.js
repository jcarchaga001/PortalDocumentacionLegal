import assert from "node:assert/strict";
import test from "node:test";
import { createAgreementRepository } from "../src/repositories/agreementRepository.js";
import { normalizeAgreementPayload } from "../src/services/agreementService.js";

const validPayload = Object.freeze({
  clientId: 7,
  accountManagerCode: "1001",
  branchIds: [223],
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  creditDays: 30,
  creditLimit: 50000,
  hasPromissoryNote: false,
});

test("API reproduce orden y textos de validación de GuardarOnClick", () => {
  const cases = [
    [{ ...validPayload, clientId: 0 }, "clientId", "Seleccione al Cliente del convenio."],
    [{ ...validPayload, accountManagerCode: "" }, "accountManagerCode", "Seleccione al Gestor de la cuenta."],
    [{ ...validPayload, branchIds: [] }, "branchIds", "Seleccione al menos 1 sucursal que facture."],
    [{ ...validPayload, startDate: "" }, "form", "Hay Campos obligatorios vacíos."],
    [{ ...validPayload, endDate: "2025-12-31" }, "endDate", 'La "Fecha Final" debe ser mayor a la "Fecha Inicial".'],
  ];
  for (const [payload, field, message] of cases) {
    assert.throws(
      () => normalizeAgreementPayload(payload),
      (error) => error.code === "VALIDATION_ERROR" && error.field === field && error.message === message,
    );
  }
});

test("GetClientes, GetSucursales y GetEmpleados conservan filtros/sort del OML del formulario", async () => {
  const calls = [];
  const repository = createAgreementRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[]];
    },
  });
  await repository.getCatalogs(4);
  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /WHERE CodPais = \?/);
  assert.doesNotMatch(calls[0].sql, /EstadoCliente/);
  assert.match(calls[0].sql, /ORDER BY Nombre_Cliente/);
  assert.match(calls[0].sql, /LIMIT 9999999/);
  assert.match(calls[1].sql, /isAdministrativa = 0 OR Codigo_Sucursal = 768/);
  assert.match(calls[1].sql, /Codigo_InternoSucursal = 'FA900'/);
  assert.doesNotMatch(calls[1].sql, /ORDER BY/);
  assert.match(calls[1].sql, /LIMIT 500/);
  assert.match(calls[2].sql, /WHERE CodPais = \?/);
  assert.doesNotMatch(calls[2].sql, /Estado IN/);
  assert.match(calls[2].sql, /ORDER BY NombreCompleto/);
  assert.match(calls[2].sql, /LIMIT 500000/);
  assert.deepEqual(calls.map(({ parameters }) => parameters), [[4], [4], [4]]);
});
