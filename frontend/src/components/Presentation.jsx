import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  ShieldCheck,
  Activity,
  Award,
  Zap,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Layers,
  Compass,
  Target,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  DollarSign
} from 'lucide-react';
import './Presentation.css';

const NODES_DATA = [
  {
    id: 0,
    title: "Estudio de Duración Operativa",
    subtitle: "Presentación Ejecutiva del Modelo de Eficiencia en Capacitación Electoral",
    icon: Compass,
    color: "#8b5cf6", // Purple
    position: { x: 15, y: 35 },
    badge: "Visión General",
    content: {
      summary: "Con base en los históricos de procesos electorales anteriores, el INE desarrolla un estudio integral sobre la velocidad y dinamismo con que se cumplen las metas operativas en las dos etapas de capacitación.",
      details: [
        { label: "Propósito Central", desc: "Determinar científicamente los días óptimos requeridos para asegurar la correcta integración de las Mesas Directivas de Casilla (MDC)." },
        { label: "Fundamento Metodológico", desc: "Análisis de series de tiempo históricas y ajuste de curvas de rendimiento por cada uno de los 300 distritos electorales del país." },
        { label: "Alcance", desc: "Optimización de recursos financieros y humanos garantizando certeza jurídica y excelencia logística en la Jornada Electoral." }
      ],
      quote: "El rigor estadístico aplicado al calendario operativo permite transitar de la inercia temporal a la eficiencia logística garantizada."
    }
  },
  {
    id: 1,
    title: "1ª Etapa: Captación y Ciudadanía Óptima",
    subtitle: "Velocidad de alcance del umbral de Ciudadanía con Requisitos de Ley (CCRL)",
    icon: Target,
    color: "#3b82f6", // Blue
    position: { x: 35, y: 65 },
    badge: "Primera Etapa",
    content: {
      summary: "En la primera etapa se analiza meticulosamente la velocidad con la que se alcanza el número óptimo de ciudadanía sorteada y visitada que cumple todos los requisitos normativos.",
      details: [
        { label: "Velocidad de Notificación", desc: "Evaluación del ritmo diario de visitas domiciliarias realizadas por las y los CAE en todo el territorio nacional." },
        { label: "Alcanzando el Umbral Óptimo", desc: "Medición del tiempo exacto (días) en que cada distrito asegura la reserva requerida por ley (CCRL Óptimo vs. Mínimo)." },
        { label: "Identificación de Inflexión", desc: "Detección del punto en el cual el esfuerzo en campo genera rendimientos marginales decrecientes." }
      ],
      metrics: [
        { name: "Meta Óptima CCRL", value: "100%", trend: "Asegurado" },
        { name: "Ritmo Promedio", value: "Acelerado", trend: "Primeros 15 días" }
      ]
    }
  },
  {
    id: 2,
    title: "2ª Etapa: Nombramientos y Adiestramiento",
    subtitle: "Entrega de nombramientos, cursos impartidos y simulacros electorales",
    icon: Award,
    color: "#10b981", // Emerald
    position: { x: 55, y: 25 },
    badge: "Segunda Etapa",
    content: {
      summary: "Para la segunda etapa, el enfoque transita hacia la efectividad cualitativa y la destreza práctica de las y los Funcionarios de Mesa Directiva de Casilla (FMDC) designados.",
      details: [
        { label: "Entrega de Nombramientos", desc: "Monitoreo de la celeridad con que se formaliza la designación de Presidente/a, Secretarios/as y Escrutadores/as." },
        { label: "Capacitación Específica", desc: "Impartición de conocimientos técnicos y normativos adaptados a la función específica de cada cargo." },
        { label: "Simulacros y Prácticas", desc: "Registro estricto de asistencia a ejercicios vivenciales para garantizar el dominio del armado de urnas, escrutinio y cómputo." }
      ],
      metrics: [
        { name: "Simulacros Realizados", value: "Alto Impacto", trend: "Práctica Vivencial" },
        { name: "Asimilación Normativa", value: "Certificada", trend: "Cero Improvisación" }
      ]
    }
  },
  {
    id: 3,
    title: "Modelado y Riesgo Distrital",
    subtitle: "Simulación de escenarios de acortamiento y vulnerabilidad al rezago",
    icon: Activity,
    color: "#f59e0b", // Amber
    position: { x: 75, y: 65 },
    badge: "Simulación y Riesgo",
    content: {
      summary: "Una vez estudiados los comportamientos y ajustados los modelos estadísticos por distrito, se analiza el impacto directo de aplicar distintos periodos de reducción temporal.",
      details: [
        { label: "Modelos de Regresión", desc: "Proyección del comportamiento distrital ante escenarios de recorte (ej. reducción de 5, 10 o 15 días del calendario estándar)." },
        { label: "Distritos de Alto Desempeño", desc: "Identificación de zonas con capacidad logística robusta que logran sus metas en tiempo récord sin merma de calidad." },
        { label: "Alertas Tempranas de Rezago", desc: "Mapeo de distritos complejos (orografía, dispersión, inseguridad) que presentarían alto riesgo de incumplimiento si se acorta excesivamente el plazo." }
      ],
      alert: "El análisis de riesgo impide aplicar recortes 'tabla rasa', permitiendo calendarios diferenciados o focalización de apoyos."
    }
  },
  {
    id: 4,
    title: "Propuesta Ejecutiva y Costo-Beneficio",
    subtitle: "Optimización presupuestaria con garantía absoluta de cumplimiento legal",
    icon: TrendingUp,
    color: "#ec4899", // Pink
    position: { x: 88, y: 30 },
    badge: "Decisión Ejecutiva",
    content: {
      summary: "El corolario del estudio es la formulación de una propuesta de duración sustentada en un riguroso análisis costo-beneficio que integra todos los factores logísticos e históricos.",
      details: [
        { label: "Ahorro Presupuestario Substantivo", desc: "Reducción de erogaciones millonarias en honorarios, viáticos y gasto operativo de campo al eliminar días inactivos o redundantes." },
        { label: "Certeza Jurídica Intacta", desc: "Garantía de que todas las casillas contarán con el personal capacitado y acreditado conforme a los extremos de la LGIPE." },
        { label: "Decisiones Basadas en Datos", desc: "Institucionalización de un modelo dinámico de toma de decisiones para los futuros procesos electorales federales y locales." }
      ],
      highlightCard: {
        title: "Equilibrio Estratégico",
        stats: ["Eficiencia Operativa", "Suficiencia de Reservas", "Racionalidad del Gasto"]
      }
    }
  }
];

const Presentation = () => {
  const [activeNode, setActiveNode] = useState(0); // 0 to 4
  const [viewMode, setViewMode] = useState('prezi'); // 'prezi' or 'slide'
  const [isPlaying, setIsPlaying] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(false); // true when zoomed into a node in prezi view

  // Autoplay logic
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveNode((prev) => (prev + 1) % NODES_DATA.length);
      }, 7000); // 7 seconds per slide
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const handleNodeSelect = (idx) => {
    setActiveNode(idx);
    setCanvasZoom(true);
    setIsPlaying(false);
  };

  const handleNext = () => {
    setActiveNode((prev) => (prev + 1) % NODES_DATA.length);
    setIsPlaying(false);
  };

  const handlePrev = () => {
    setActiveNode((prev) => (prev - 1 + NODES_DATA.length) % NODES_DATA.length);
    setIsPlaying(false);
  };

  const toggleViewMode = () => {
    if (viewMode === 'prezi') {
      setViewMode('slide');
      setCanvasZoom(false);
    } else {
      setViewMode('prezi');
      setCanvasZoom(false);
    }
  };

  const currentNode = NODES_DATA[activeNode];
  const IconComponent = currentNode.icon;

  return (
    <div className="presentation-container">
      {/* Top Presentation Header */}
      <div className="presentation-top-bar">
        <div className="presentation-branding">
          <div className="branding-tag">INE PREZI UX</div>
          <h2>Estudio de Duración Operativa <span>1ª y 2ª Etapa de Capacitación</span></h2>
        </div>

        <div className="presentation-controls-group">
          {/* View Mode Selector */}
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'prezi' ? 'active' : ''}`}
              onClick={() => { setViewMode('prezi'); setCanvasZoom(false); }}
              title="Modo Lienzo Espacial (Prezi)"
            >
              <Layers size={16} />
              <span>Lienzo Espacial</span>
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'slide' ? 'active' : ''}`}
              onClick={() => { setViewMode('slide'); }}
              title="Modo Diapositivas Guiado"
            >
              <Maximize2 size={16} />
              <span>Diapositivas</span>
            </button>
          </div>

          {/* Autoplay Toggle */}
          <button
            className={`action-pill-btn ${isPlaying ? 'active-pulse' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pausar avance automático" : "Reproducción automática (7s)"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? "Pausar" : "Autoplay"}</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {viewMode === 'prezi' ? (
        /* ============================================ */
        /* MODO 1: LIENZO ESPACIAL (PREZI VIEW)         */
        /* ============================================ */
        <div className={`prezi-canvas-wrapper ${canvasZoom ? 'zoomed-in' : 'overview'}`}>
          {/* Lienzo de fondo con conectores */}
          <div className="canvas-background">
            <svg className="connector-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
                  <stop offset="25%" stopColor="#3b82f6" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#10b981" stopOpacity="0.6" />
                  <stop offset="75%" stopColor="#f59e0b" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <path
                d={`M ${NODES_DATA[0].position.x} ${NODES_DATA[0].position.y} 
                    Q 25 80, ${NODES_DATA[1].position.x} ${NODES_DATA[1].position.y} 
                    T ${NODES_DATA[2].position.x} ${NODES_DATA[2].position.y} 
                    T ${NODES_DATA[3].position.x} ${NODES_DATA[3].position.y} 
                    T ${NODES_DATA[4].position.x} ${NODES_DATA[4].position.y}`}
                fill="none"
                stroke="url(#lineGrad)"
                strokeWidth="0.8"
                strokeDasharray="2,1"
                className="animated-connector-path"
              />
            </svg>
          </div>

          {/* Nodos Interactivos en el Lienzo */}
          <div className="canvas-nodes-plane">
            {NODES_DATA.map((node, i) => {
              const NodeIcon = node.icon;
              const isSelected = activeNode === i;
              return (
                <div
                  key={node.id}
                  className={`prezi-node-orb ${isSelected ? 'active-orb' : ''}`}
                  style={{
                    left: `${node.position.x}%`,
                    top: `${node.position.y}%`,
                    '--node-color': node.color
                  }}
                  onClick={() => handleNodeSelect(i)}
                >
                  <div className="orb-ring" style={{ borderColor: node.color }}></div>
                  <div className="orb-core" style={{ backgroundColor: node.color }}>
                    <NodeIcon size={24} color="#ffffff" />
                  </div>
                  <div className="orb-label">
                    <span className="orb-step">0{i + 1}</span>
                    <h4>{node.title.split(':')[0]}</h4>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tarjeta Modal Detallada al hacer Zoom */}
          {canvasZoom && (
            <div className="zoomed-modal-overlay" onClick={() => setCanvasZoom(false)}>
              <div
                className="zoomed-detail-card glow-premium"
                style={{ '--card-glow': currentNode.color }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="zoomed-header">
                  <div className="badge-pill" style={{ backgroundColor: `${currentNode.color}20`, color: currentNode.color, borderColor: `${currentNode.color}50` }}>
                    <IconComponent size={16} />
                    <span>Paso 0{activeNode + 1}: {currentNode.badge}</span>
                  </div>
                  <button className="close-zoom-btn" onClick={() => setCanvasZoom(false)} title="Volver al Lienzo">
                    <Minimize2 size={18} />
                    <span>Ver Lienzo</span>
                  </button>
                </div>

                <h2 className="zoomed-title">{currentNode.title}</h2>
                <p className="zoomed-subtitle">{currentNode.subtitle}</p>
                <p className="zoomed-summary">{currentNode.content.summary}</p>

                <div className="details-grid">
                  {currentNode.content.details.map((item, idx) => (
                    <div key={idx} className="detail-item-box">
                      <div className="box-dot" style={{ backgroundColor: currentNode.color }}></div>
                      <div className="box-text">
                        <h5>{item.label}</h5>
                        <p>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {currentNode.content.metrics && (
                  <div className="modal-metrics-bar">
                    {currentNode.content.metrics.map((m, idx) => (
                      <div key={idx} className="metric-pill">
                        <span className="metric-val" style={{ color: currentNode.color }}>{m.value}</span>
                        <div className="metric-info">
                          <span className="metric-lbl">{m.name}</span>
                          <span className="metric-trd">{m.trend}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {currentNode.content.alert && (
                  <div className="modal-alert-box">
                    <AlertTriangle size={20} color="#f59e0b" className="flex-shrink-0" />
                    <p>{currentNode.content.alert}</p>
                  </div>
                )}

                {currentNode.content.highlightCard && (
                  <div className="highlight-executive-box" style={{ borderColor: currentNode.color }}>
                    <h4>🌟 {currentNode.content.highlightCard.title}</h4>
                    <div className="tags-row">
                      {currentNode.content.highlightCard.stats.map((tag, tIdx) => (
                        <span key={tIdx} className="exec-tag" style={{ backgroundColor: `${currentNode.color}15`, color: currentNode.color }}>
                          <CheckCircle2 size={14} /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {currentNode.content.quote && (
                  <blockquote className="executive-quote">
                    "{currentNode.content.quote}"
                  </blockquote>
                )}

                {/* Modal Footer Controls */}
                <div className="modal-footer-nav">
                  <button className="nav-pill-btn" onClick={handlePrev}>
                    <ChevronLeft size={18} /> Anterior
                  </button>
                  <div className="step-dots">
                    {NODES_DATA.map((_, i) => (
                      <span
                        key={i}
                        className={`step-dot ${activeNode === i ? 'active' : ''}`}
                        onClick={() => handleNodeSelect(i)}
                        style={{ backgroundColor: activeNode === i ? currentNode.color : '#334155' }}
                      />
                    ))}
                  </div>
                  <button className="nav-pill-btn" onClick={handleNext}>
                    Siguiente <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Helper in Overview */}
          {!canvasZoom && (
            <div className="overview-instruction-banner">
              <Info size={18} color="#a855f7" />
              <span>Haz clic en cualquiera de los nodos estratégicos para realizar un zoom inmersivo y explorar los detalles del estudio.</span>
            </div>
          )}
        </div>
      ) : (
        /* ============================================ */
        /* MODO 2: DIAPOSITIVAS GUIADAS (SLIDE VIEW)   */
        /* ============================================ */
        <div className="slide-view-container">
          {/* Main Slide Card */}
          <div className="slide-card premium-glass" style={{ '--accent-glow': currentNode.color }}>
            <div className="slide-card-header">
              <div className="slide-number-indicator" style={{ color: currentNode.color }}>
                <span>0{activeNode + 1}</span> / 0{NODES_DATA.length}
              </div>
              <div className="slide-badge-container">
                <div className="badge-pill" style={{ backgroundColor: `${currentNode.color}20`, color: currentNode.color, borderColor: `${currentNode.color}50` }}>
                  <IconComponent size={16} />
                  <span>{currentNode.badge}</span>
                </div>
              </div>
            </div>

            <div className="slide-card-body">
              <h1 className="slide-hero-title" style={{ background: `linear-gradient(135deg, #ffffff 40%, ${currentNode.color})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {currentNode.title}
              </h1>
              <p className="slide-hero-subtitle">{currentNode.subtitle}</p>

              <div className="slide-summary-box">
                <Info size={20} color={currentNode.color} className="flex-shrink-0 mt-1" />
                <p>{currentNode.content.summary}</p>
              </div>

              <div className="slide-grid-3">
                {currentNode.content.details.map((item, idx) => (
                  <div key={idx} className="feature-block-card">
                    <div className="feature-icon-top" style={{ color: currentNode.color, backgroundColor: `${currentNode.color}15` }}>
                      <span>0{idx + 1}</span>
                    </div>
                    <h3>{item.label}</h3>
                    <p>{item.desc}</p>
                  </div>
                ))}
              </div>

              {currentNode.content.metrics && (
                <div className="slide-metrics-row">
                  {currentNode.content.metrics.map((m, idx) => (
                    <div key={idx} className="slide-metric-card" style={{ borderColor: `${currentNode.color}30` }}>
                      <span className="metric-val" style={{ color: currentNode.color }}>{m.value}</span>
                      <span className="metric-lbl">{m.name}</span>
                      <span className="metric-trd">{m.trend}</span>
                    </div>
                  ))}
                </div>
              )}

              {currentNode.content.alert && (
                <div className="slide-alert-banner">
                  <AlertTriangle size={20} color="#f59e0b" className="flex-shrink-0" />
                  <p>{currentNode.content.alert}</p>
                </div>
              )}

              {currentNode.content.highlightCard && (
                <div className="slide-highlight-card" style={{ borderColor: currentNode.color, backgroundColor: `${currentNode.color}08` }}>
                  <h3>🌟 {currentNode.content.highlightCard.title}</h3>
                  <div className="exec-tags-container">
                    {currentNode.content.highlightCard.stats.map((tag, tIdx) => (
                      <span key={tIdx} className="exec-tag-pill" style={{ backgroundColor: `${currentNode.color}20`, color: currentNode.color }}>
                        <CheckCircle2 size={16} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {currentNode.content.quote && (
                <blockquote className="slide-quote">
                  "{currentNode.content.quote}"
                </blockquote>
              )}
            </div>

            {/* Slide Navigation Footer */}
            <div className="slide-footer-bar">
              <button className="nav-arrow-btn" onClick={handlePrev} title="Diapositiva Anterior">
                <ChevronLeft size={24} />
              </button>

              <div className="progress-timeline-container">
                <div className="timeline-track">
                  <div
                    className="timeline-fill"
                    style={{
                      width: `${((activeNode + 1) / NODES_DATA.length) * 100}%`,
                      backgroundColor: currentNode.color
                    }}
                  />
                </div>
                <div className="timeline-labels">
                  {NODES_DATA.map((node, i) => (
                    <button
                      key={node.id}
                      className={`timeline-label-item ${activeNode === i ? 'active' : ''}`}
                      onClick={() => { setActiveNode(i); setIsPlaying(false); }}
                      style={{ color: activeNode === i ? currentNode.color : '#64748b' }}
                    >
                      0{i + 1}. {node.badge}
                    </button>
                  ))}
                </div>
              </div>

              <button className="nav-arrow-btn" onClick={handleNext} title="Siguiente Diapositiva">
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Presentation;
