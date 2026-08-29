import assert from "node:assert/strict";
import test from "node:test";
import {
  paginationPages,
  paginationSummary,
  permissionActionFor,
  USER_PERMISSION_COLUMNS,
  USER_PERMISSION_EMPTY_TEXT,
  USER_PERMISSION_PAGE_SIZE,
  USER_PERMISSION_QUERY_ERROR,
  USER_PERMISSION_SUCCESS,
} from "../src/pages/userPermissionsParity.js";

test("scrUsuariosPermisos conserva textos, MaxRecords y columnas del runtime", () => {
  assert.equal(USER_PERMISSION_PAGE_SIZE, 500);
  assert.equal(USER_PERMISSION_EMPTY_TEXT, "No hay datos para mostrar...");
  assert.equal(USER_PERMISSION_QUERY_ERROR, "Error executing query.");
  assert.equal(USER_PERMISSION_SUCCESS, "¡Registro Completado!");
  assert.deepEqual(USER_PERMISSION_COLUMNS.map(({ label }) => label), [
    "Codigo SAF",
    "Nombre Persona",
    "Puesto",
    "Correo",
    "Acceso Permitido",
  ]);
  assert.deepEqual(USER_PERMISSION_COLUMNS.map(({ sortable }) => sortable), [true, true, true, true, false]);
});

test("los iconos y tooltips representan el estado actual y envían el opuesto", () => {
  assert.deepEqual(permissionActionFor(false), {
    allowed: false,
    nextAllowed: true,
    description: "Habilitó acceso",
    infoMessage: "True",
    icon: "fa-ban",
    color: "#f70000",
    tooltip: "Habilitar",
  });
  assert.deepEqual(permissionActionFor(1), {
    allowed: true,
    nextAllowed: false,
    description: "Deshabilitó acceso",
    infoMessage: "False",
    icon: "fa-check",
    color: "#228700",
    tooltip: "Inhabilitar",
  });
});

test("paginación replica el resumen de 500 filas y la segunda página", () => {
  assert.equal(paginationSummary(1, 500, 876), "1 to 500 of 876 items");
  assert.equal(paginationSummary(2, 500, 876), "501 to 876 of 876 items");
  assert.equal(paginationSummary(1, 500, 0), "0 to 0 of 0 items");
  assert.deepEqual(paginationPages(876), [1, 2]);
});
