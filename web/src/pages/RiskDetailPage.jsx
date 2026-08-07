import { ArrowLeftOutlined, FilePdfOutlined } from "@ant-design/icons";
import { Alert, Collapse, Spin } from "antd";
import { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { getRiskAnalysisDetail } from "../services/riskService.js";
import { getS3TemporaryUrl } from "../services/tdS3Service.js";
import "../styles/risk.css";

function temporaryUrl(result) {
  return result?.data?.url || result?.data?.data?.url || result?.data?.data?.data?.url || "";
}

export function RiskDetailPage() {
  const history = useHistory();
  const location = useLocation();
  const codArchivo = new URLSearchParams(location.search).get("CodArchivo");
  const [analysis, setAnalysis] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const result = await getRiskAnalysisDetail(codArchivo);
      if (!active) return;
      if (!result.success) {
        setError(result.message || "No fue posible consultar el detalle del análisis de riesgo.");
        setLoading(false);
        return;
      }
      setAnalysis(result.data);
      setError("");
      if (result.data?.s3Key) {
        const urlResult = await getS3TemporaryUrl({ s3Key: result.data.s3Key, expiresInSeconds: 3600 });
        if (active && urlResult.success) setPdfUrl(temporaryUrl(urlResult));
      }
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [codArchivo]);

  if (loading) {
    return <div className="legacy-risk-detail-loading"><Spin size="large" tip="Cargando..." /></div>;
  }

  return (
    <div className="legacy-risk-detail-page">
      <div className="legacy-risk-detail-title-row">
        <h1>Detalle Análisis Contrato</h1>
        <button type="button" onClick={() => history.push("/scrHistoricoRiesgo")}>
          <ArrowLeftOutlined /> Regresar
        </button>
      </div>

      {error && <Alert type="error" showIcon message={error} />}

      {analysis && (
        <div className="legacy-risk-detail-grid">
          <div className="legacy-risk-pdf-panel">
            {pdfUrl ? (
              <iframe title={`Contrato ${analysis.codArchivo}`} src={pdfUrl} sandbox="" referrerPolicy="no-referrer" />
            ) : (
              <div className="legacy-risk-pdf-empty">
                <FilePdfOutlined />
                <span>Documento no disponible</span>
              </div>
            )}
          </div>

          <div className="legacy-risk-analysis-panel">
            <div className="legacy-risk-score-block">
              <span>Riesgo Puntaje</span>
              <strong className={Number(analysis.riskScore) >= 9 ? "legacy-risk-critical" : ""}>
                {Number(analysis.riskScore)}
              </strong>
            </div>

            <Collapse
              className="legacy-risk-clauses"
              items={(analysis.clauses || []).map((clause) => ({
                key: clause.key,
                label: clause.title,
                children: (
                  <div className="legacy-risk-clause-fields">
                    {(clause.fields || []).map((field) => (
                      <div className="legacy-risk-clause-field" key={field.key}>
                        <span>{field.label}</span>
                        <p>{field.value}</p>
                      </div>
                    ))}
                  </div>
                ),
              }))}
            />

            <div className="legacy-risk-comments">
              <section>
                <h2>Comentario Breve</h2>
                <p>{analysis.shortComment || ""}</p>
              </section>
              <section>
                <h2>Comentario Riesgo</h2>
                <p>{analysis.riskComment || ""}</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
