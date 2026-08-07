import { DownloadOutlined } from "@ant-design/icons";
import { Button, Drawer } from "antd";

function PreviewContent({ extension, url }) {
  if (!url) return <div className="legacy-document-empty-file">No existe el archivo...</div>;
  if (["jpg", "jpeg", "png", "bmp"].includes(extension)) {
    return <img className="legacy-document-image" src={url} alt="Vista previa del documento" />;
  }
  if (extension === "pdf") {
    return <iframe className="legacy-document-pdf" src={url} title="Vista previa del documento" sandbox="" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="legacy-document-empty-file">
      No se puede leer archivo (Archivo con errores)
    </div>
  );
}

export function DocumentAttachmentDrawer({ preview, onClose }) {
  return (
    <Drawer
      title="Vista Previa de Archivo"
      size="50%"
      open={Boolean(preview)}
      onClose={onClose}
      destroyOnHidden
      extra={preview?.url ? (
        <Button
          type="text"
          href={preview.url}
          download={preview.fileName}
          icon={<DownloadOutlined />}
          aria-label="Descargar archivo"
          title="Descargar archivo"
        />
      ) : null}
    >
      {preview ? <PreviewContent {...preview} /> : null}
    </Drawer>
  );
}

export function previewFromAttachment(record, blob) {
  const fileName = record.attachmentFileName || record.reference || "Documento";
  return {
    url: URL.createObjectURL(blob),
    fileName,
    extension: String(fileName).split(".").pop().toLowerCase(),
  };
}
