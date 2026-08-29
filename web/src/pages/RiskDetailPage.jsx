import { Spin } from "antd";
import { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { getRiskAnalysisDetail } from "../services/riskService.js";
import { getS3TemporaryUrl } from "../services/tdS3Service.js";
import { compactRiskScore, RISK_QUERY_ERROR } from "./riskParity.js";
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
  const [activeClause, setActiveClause] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setAnalysis(null);
      setPdfUrl("");
      setActiveClause("");
      const result = await getRiskAnalysisDetail(codArchivo);
      if (!active) return;
      if (!result.success) {
        setError(RISK_QUERY_ERROR);
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
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            history.push("/scrHistoricoRiesgo");
          }}
        >
          <i className="fa fa-arrow-circle-left fa-2x" aria-hidden="true" />
          <span>Regresar</span>
        </a>
      </div>

      <LegacyErrorFeedback message={error} />

      {analysis && (
        <>
          <div className="legacy-risk-detail-grid">
            <div className="legacy-risk-pdf-panel">
              <iframe title={`Contrato ${analysis.codArchivo}`} src={pdfUrl || "about:blank"} />
            </div>

            <div className="legacy-risk-analysis-panel">
              <div className="legacy-risk-score-block">
                <span>Riesgo Puntaje</span>
                <strong className={Number(analysis.riskScore) >= 9 ? "legacy-risk-critical" : ""}>
                  {compactRiskScore(analysis.riskScore)}
                </strong>
              </div>

              <div className="legacy-risk-clauses">
                {(analysis.clauses || []).map((clause) => {
                  const expanded = activeClause === clause.key;
                  return (
                    <section className={`legacy-risk-accordion-item${expanded ? " is-expanded" : ""}`} key={clause.key}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`risk-clause-${clause.key}`}
                        onClick={() => setActiveClause(expanded ? "" : clause.key)}
                      >
                        <span>{clause.title}</span>
                        <i className={`fa fa-angle-down${expanded ? " is-expanded" : ""}`} aria-hidden="true" />
                      </button>
                      {expanded ? (
                        <div id={`risk-clause-${clause.key}`} className="legacy-risk-clause-content" role="region" aria-label={clause.title}>
                          {(clause.fields || []).map((field, index) => (
                            <div className="legacy-risk-clause-field" key={`${field.key}-${index}`}>
                              <span>{field.label}</span>
                              <p>{field.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>

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
        </>
      )}
    </div>
  );
}
