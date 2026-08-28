import { ArrowLeftOutlined, DeleteOutlined, DownloadOutlined, ExclamationCircleOutlined, PaperClipOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Space, Table, Tooltip, Upload, message } from "antd";
import { useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import { bulkUpsertCorporateClients } from "../services/corporateClientService.js";
import {
  downloadCorporateClientTemplate,
  parseCorporateClientWorkbook,
  validateCorporateClientImportRows,
} from "../services/spreadsheetService.js";

export function CorporateClientBulkPage() {
  const history = useHistory();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const hasInvalidRows = rows.some((row) => !row.isValid);

  const columns = useMemo(() => [
    { title: "CodigoFA", dataIndex: "faCode", key: "faCode", width: 140 },
    { title: "Nombre Cliente", dataIndex: "name", key: "name", width: 280 },
    { title: "Nombre Contacto", dataIndex: "contactName", key: "contactName", width: 220 },
    { title: "Puesto Contacto", dataIndex: "contactPosition", key: "contactPosition", width: 220 },
    { title: "Teléfono Contacto", dataIndex: "contactPhone", key: "contactPhone", width: 180 },
    { title: "Correo Contacto", dataIndex: "contactEmail", key: "contactEmail", width: 240 },
    {
      title: hasInvalidRows ? (
        <Tooltip title="Remover todos los registros no validos">
          <Button
            type="link"
            danger
            aria-label="Remover todos los registros no validos"
            icon={<DeleteOutlined />}
            onClick={() => setRows((current) => current.filter((row) => row.isValid))}
          />
        </Tooltip>
      ) : null,
      key: "actions",
      width: 96,
      render: (_, row) => !row.isValid ? (
        <Space size="small">
          <Tooltip title={row.validationMessage}><ExclamationCircleOutlined /></Tooltip>
          <Tooltip title="Remover registro">
            <Button
              type="link"
              danger
              aria-label="Remover registro"
              icon={<DeleteOutlined />}
              onClick={() => setRows((current) => current.filter((item) => item.importRowId !== row.importRowId))}
            />
          </Tooltip>
        </Space>
      ) : null,
    },
  ], [hasInvalidRows]);

  async function readFile(selectedFile) {
    setFile(selectedFile);
    try {
      const items = await parseCorporateClientWorkbook(selectedFile);
      setRows(validateCorporateClientImportRows(items));
      if (!items.length) message.warning("El archivo no contiene clientes.");
    } catch (error) {
      setRows([]);
      message.error(error.message);
    }
    return false;
  }

  async function upload() {
    if (!rows.length) {
      message.warning("Seleccione un archivo con clientes.");
      return;
    }
    setLoading(true);
    const result = await bulkUpsertCorporateClients(rows);
    if (result.success) {
      message.success(`${result.data.processed} clientes procesados: ${result.data.created} creados y ${result.data.updated} actualizados.`);
      history.replace(ROUTES.corporateClients);
    } else message.error(result.message);
    setLoading(false);
  }

  return (
    <div className="legacy-list-page">
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => history.push(ROUTES.corporateClients)}>Volver al listado</Button>
      <div className="legacy-list-toolbar">
        <Button type="link" icon={<DownloadOutlined />} onClick={downloadCorporateClientTemplate}>Descargar Plantilla</Button>
      </div>
      <h1>Carga Masiva Clientes Corporativos</h1>
      <section className="legacy-bulk-upload">
        <span>Excel a Cargar</span>
        <Space>
          <Upload maxCount={1} showUploadList={false} beforeUpload={readFile}>
            <Button icon={<PaperClipOutlined />}>{file?.name || "Seleccione un archivo.."}</Button>
          </Upload>
          <Button type="primary" icon={<UploadOutlined />} loading={loading} disabled={hasInvalidRows} onClick={upload}>Subir</Button>
        </Space>
      </section>
      <Table
        className="legacy-history-table"
        rowKey="importRowId"
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 20 }}
        onRow={(row) => ({ style: row.isValid ? undefined : { backgroundColor: "#ecdada" } })}
      />
    </div>
  );
}
