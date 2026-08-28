import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentRepository } from "../src/repositories/documentRepository.js";

test("detalle de sucursal conserva fuentes, orden y multimedia del OML", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/FROM .*tblSucursales s/.test(sql)) {
        return [[{
          id: 226,
          code: "FA63",
          name: "TGU - La Centroamerica",
          areaManagerName: "Gerente Area",
          pharmacyManagerName: "Gerente Farmacia",
          pharmacyManagerEmail: "gf@example.test",
        }], []];
      }
      if (/tblSucursalesMultimedia/.test(sql)) {
        return [[{ buffer: Buffer.from("image"), extension: "png", fileName: "fa63.png" }], []];
      }
      if (/tblSubcategoriaDocumentos sc/.test(sql)) {
        return [[{
          categoryId: 1,
          categoryName: "Licencias",
          subcategoryId: 2,
          subcategoryName: "Licencia Sanitaria",
          isRequired: 1,
          documentId: 3,
          reference: "LCN-01-000004",
          description: "HN-LEPF-1119-0008",
          documentDate: "2025-12-22",
          expirationDate: "2027-10-02",
          isReferential: 0,
          statusName: "Vigente",
          statusId: 2,
          attachmentId: 4,
          attachmentFileName: "licencia.pdf",
          attachmentExtension: "pdf",
          attachmentS3Key: "legacy-key.pdf",
          hasAttachment: 1,
        }], []];
      }
      if (/tblLibroxSucursal assignment/.test(sql)) return [[], []];
      throw new Error(`SQL no esperada: ${sql}`);
    },
  };
  const repository = createDocumentRepository(pool);

  const detail = await repository.getBranchDetail(4, 226);

  assert.equal(detail.branch.pharmacyManagerEmail, "gf@example.test");
  assert.equal(detail.branch.image.fileBase64, Buffer.from("image").toString("base64"));
  assert.equal(detail.documents[0].document.hasAttachment, true);
  assert.equal(detail.documents[0].document.attachment.hasS3, true);
  const branchQuery = calls.find(({ sql }) => /FROM .*tblSucursales s/.test(sql));
  assert.match(branchQuery.sql, /gf\.Correo_electronico/);
  const imageQuery = calls.find(({ sql }) => /tblSucursalesMultimedia/.test(sql));
  assert.deepEqual(imageQuery.parameters, [226, 4]);
  assert.match(imageQuery.sql, /`dbpqiygwlvvnhg`\.tblSucursalesMultimedia/);
  assert.doesNotMatch(imageQuery.sql, /`dbTesoreriaDev`\.tblSucursalesMultimedia/);
  const documentQuery = calls.find(({ sql }) => /tblSubcategoriaDocumentos sc/.test(sql));
  assert.match(documentQuery.sql, /ORDER BY sc\.isObligatorio DESC/);
  assert.match(documentQuery.sql, /LIMIT 50/);
  assert.match(documentQuery.sql, /a\.CodS3 AS attachmentS3Key/);
  assert.doesNotMatch(documentQuery.sql, /WHERE sc\.codigoPais/);
  assert.deepEqual(documentQuery.parameters, [4, 226]);
  assert.doesNotMatch(documentQuery.sql, /ORDER BY c\.nombreCategoria/);
});
