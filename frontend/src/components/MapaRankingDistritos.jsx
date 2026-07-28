import { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import mexicoGeoData from '../data/mexico_geo.json';
import distritosGeometriaMexico from '../data/distritos_geometria_mexico.json';

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 720;
const MAP_PADDING = 28;
const NO_DATA_COLOR = '#d9dee7';
const RANKING_FILE = `${import.meta.env.BASE_URL}ranking_pe_vceyec_distritos.xlsx`;

const STATE_ALIASES = {
    'estado de mexico': 'mexico',
    cdmx: 'ciudad de mexico',
    'veracruz de ignacio de la llave': 'veracruz',
    'coahuila de zaragoza': 'coahuila',
    'michoacan de ocampo': 'michoacan',
};

const UTM_ZONE_BY_STATE = {
    aguascalientes: 13, 'baja california': 11, 'baja california sur': 12,
    campeche: 15, chiapas: 15, chihuahua: 13, 'ciudad de mexico': 14,
    coahuila: 14, colima: 13, durango: 13, guanajuato: 14, guerrero: 14,
    hidalgo: 14, jalisco: 13, mexico: 14, michoacan: 14, morelos: 14,
    nayarit: 13, 'nuevo leon': 14, oaxaca: 14, puebla: 14, queretaro: 14,
    'quintana roo': 16, 'san luis potosi': 14, sinaloa: 13, sonora: 12,
    tabasco: 15, tamaulipas: 14, tlaxcala: 14, veracruz: 14, yucatan: 16,
    zacatecas: 13,
};

const normalizeText = (value = '') => {
    const normalized = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
    return STATE_ALIASES[normalized] || normalized;
};

const districtKey = (entity, district) => `${normalizeText(entity)}|${Number(district)}`;

// Conversión inversa de UTM (ITRF/WGS84) a longitud/latitud. La fuente
// distrital usa una zona UTM distinta según la ubicación de cada entidad.
const utmToLonLat = (easting, northing, zone) => {
    const semiMajorAxis = 6378137;
    const eccentricity = 0.08181919084262149;
    const eccentricitySquared = eccentricity ** 2;
    const scaleFactor = 0.9996;
    const x = easting - 500000;
    const meridionalArc = northing / scaleFactor;
    const mu = meridionalArc / (semiMajorAxis * (1 - eccentricitySquared / 4
        - 3 * eccentricitySquared ** 2 / 64 - 5 * eccentricitySquared ** 3 / 256));
    const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) / (1 + Math.sqrt(1 - eccentricitySquared));
    const footpointLatitude = mu
        + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
        + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
    const cosFootpoint = Math.cos(footpointLatitude);
    const tanSquared = Math.tan(footpointLatitude) ** 2;
    const c1 = secondEccentricitySquared * cosFootpoint ** 2;
    const n1 = semiMajorAxis / Math.sqrt(1 - eccentricitySquared * Math.sin(footpointLatitude) ** 2);
    const r1 = semiMajorAxis * (1 - eccentricitySquared)
        / (1 - eccentricitySquared * Math.sin(footpointLatitude) ** 2) ** 1.5;
    const d = x / (n1 * scaleFactor);
    const latitude = footpointLatitude - (n1 * Math.tan(footpointLatitude) / r1) * (
        d ** 2 / 2 - (5 + 3 * tanSquared + 10 * c1 - 4 * c1 ** 2
            - 9 * secondEccentricitySquared) * d ** 4 / 24
        + (61 + 90 * tanSquared + 298 * c1 + 45 * tanSquared ** 2
            - 252 * secondEccentricitySquared - 3 * c1 ** 2) * d ** 6 / 720
    );
    const longitudeOffset = (d - (1 + 2 * tanSquared + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * tanSquared - 3 * c1 ** 2
            + 8 * secondEccentricitySquared + 24 * tanSquared ** 2) * d ** 5 / 120)
        / cosFootpoint;
    return [zone * 6 - 183 + longitudeOffset * 180 / Math.PI, latitude * 180 / Math.PI];
};

const createProjector = () => {
    const [minLongitude, maxLongitude, minLatitude, maxLatitude] = [-118.6, -86.5, 14.1, 32.8];
    const latitudeScale = Math.cos(23.5 * Math.PI / 180);
    const longitudeSpan = (maxLongitude - minLongitude) * latitudeScale;
    const latitudeSpan = maxLatitude - minLatitude;
    const scale = Math.min((MAP_WIDTH - MAP_PADDING * 2) / longitudeSpan,
        (MAP_HEIGHT - MAP_PADDING * 2) / latitudeSpan);
    const offsetX = (MAP_WIDTH - longitudeSpan * scale) / 2;
    const offsetY = (MAP_HEIGHT - latitudeSpan * scale) / 2;
    return ([longitude, latitude]) => [
        offsetX + (longitude - minLongitude) * latitudeScale * scale,
        MAP_HEIGHT - offsetY - (latitude - minLatitude) * scale,
    ];
};

const project = createProjector();
const ringsToPath = rings => rings.map(ring => {
    if (!ring?.length) return '';
    return ring.map((point, index) => {
        const [x, y] = project(point);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ') + ' Z';
}).join(' ');

const geoJsonGeometryToPath = geometry => {
    if (!geometry) return '';
    if (geometry.type === 'Polygon') return ringsToPath(geometry.coordinates);
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(ringsToPath).join(' ');
    return '';
};

const rankingColor = ranking => {
    if (!Number.isFinite(ranking)) return NO_DATA_COLOR;
    const t = Math.min(3, Math.max(0, ranking)) / 3;
    const stops = [[220, 38, 38], [250, 204, 21], [22, 163, 74]];
    const segment = t <= 0.5 ? 0 : 1;
    const localT = segment === 0 ? t * 2 : (t - 0.5) * 2;
    const rgb = stops[segment].map((value, index) =>
        Math.round(value + (stops[segment + 1][index] - value) * localT));
    return `rgb(${rgb.join(', ')})`;
};

const districtShapes = Object.entries(distritosGeometriaMexico).flatMap(([entityKey, districts]) => {
    const zone = UTM_ZONE_BY_STATE[entityKey];
    if (!zone) return [];
    return districts.map(district => ({
        entityKey,
        district: Number(district.d),
        path: ringsToPath((district.c || []).map(polygon =>
            polygon.map(([easting, northing]) => utmToLonLat(easting, northing, zone)))),
    }));
});

const stateShapes = mexicoGeoData.features.map(feature => ({
    name: feature.properties?.name || 'Entidad',
    path: geoJsonGeometryToPath(feature.geometry),
}));

const stateNameByKey = new Map(stateShapes.map(state => [normalizeText(state.name), state.name]));

const readRankings = async () => {
    const response = await fetch(RANKING_FILE);
    if (!response.ok) throw new Error(`No fue posible cargar el Excel (${response.status}).`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('El Excel no contiene hojas de trabajo.');
    const headers = new Map();
    worksheet.getRow(1).eachCell((cell, column) => {
        headers.set(String(cell.value ?? '').trim(), column);
    });
    const entityColumn = headers.get('Entidad federativa');
    const districtColumn = headers.get('¿En qué distrito electoral federal?');
    const rankingColumn = headers.get('Ranking experiencia PE VCEyEC actual');
    if (!entityColumn || !districtColumn || !rankingColumn) {
        throw new Error('El Excel no contiene las tres columnas requeridas.');
    }
    const rankings = new Map();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const entity = row.getCell(entityColumn).value;
        const district = Number(row.getCell(districtColumn).value);
        const ranking = Number(row.getCell(rankingColumn).value);
        if (entity && Number.isFinite(district) && Number.isFinite(ranking)) {
            rankings.set(districtKey(entity, district), { entity: String(entity), district, ranking });
        }
    }
    return rankings;
};

const MapaRankingDistritos = () => {
    const [rankings, setRankings] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hovered, setHovered] = useState(null);

    useEffect(() => {
        let active = true;
        readRankings().then(data => { if (active) setRankings(data); })
            .catch(loadError => {
                console.error('Error al cargar rankings distritales', loadError);
                if (active) setError(loadError.message || 'No fue posible cargar los rankings.');
            }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const districts = useMemo(() => districtShapes.map(shape => {
        const rankingRow = rankings.get(districtKey(shape.entityKey, shape.district));
        return {
            ...shape,
            entity: rankingRow?.entity || stateNameByKey.get(shape.entityKey) || shape.entityKey,
            ranking: rankingRow?.ranking,
        };
    }), [rankings]);
    const rankedCount = districts.filter(district => Number.isFinite(district.ranking)).length;

    return (
        <main className="ranking-map-page">
            <section className="ranking-map-card">
                <header className="ranking-map-header">
                    <div>
                        <span className="ranking-map-kicker">Experiencia PE VCEyEC actual</span>
                        <h1>Ranking por distrito electoral federal</h1>
                        <p>Mapa nacional con límites de entidades federativas y de los 300 distritos electorales federales.</p>
                    </div>
                    <div className="ranking-map-summary" aria-live="polite">
                        <strong>{loading ? '—' : rankedCount}</strong><span>distritos con ranking</span>
                    </div>
                </header>

                <div className="ranking-map-legend" aria-label="Escala de color del ranking">
                    <span>Ranking</span>
                    {[0, 1, 2, 3].map(value => <div key={value}><i style={{ background: rankingColor(value) }} />{value}</div>)}
                    <div><i style={{ background: NO_DATA_COLOR }} />Sin dato</div>
                </div>

                {error ? <div className="ranking-map-message error">{error}</div> : (
                    <div className="ranking-map-canvas">
                        {loading && <div className="ranking-map-message">Cargando rankings…</div>}
                        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img"
                            aria-label="Mapa de México coloreado por ranking distrital">
                            <g className="ranking-district-layer">
                                {districts.map(district => (
                                    <path key={`${district.entityKey}-${district.district}`} d={district.path}
                                        fill={rankingColor(district.ranking)} className="ranking-district"
                                        fillRule="evenodd" onMouseEnter={() => setHovered(district)}
                                        onMouseLeave={() => setHovered(null)}>
                                        <title>{`${district.entity} · Distrito ${String(district.district).padStart(2, '0')} · ${Number.isFinite(district.ranking) ? `Ranking ${district.ranking}` : 'Sin dato'}`}</title>
                                    </path>
                                ))}
                            </g>
                            <g className="ranking-state-layer" pointerEvents="none">
                                {stateShapes.map(state => <path key={state.name} d={state.path}
                                    className="ranking-state-border" fill="none" fillRule="evenodd" />)}
                            </g>
                        </svg>
                        {hovered && (
                            <aside className="ranking-map-tooltip visible">
                                <span>{hovered.entity}</span>
                                <strong>Distrito {String(hovered.district).padStart(2, '0')}</strong>
                                <em>{Number.isFinite(hovered.ranking) ? `Ranking: ${hovered.ranking}` : 'Ranking: Sin dato'}</em>
                            </aside>
                        )}
                    </div>
                )}

                <footer className="ranking-map-notes">
                    <span><i className="district-line-sample" />Límite distrital</span>
                    <span><i className="state-line-sample" />Límite estatal</span>
                    {!loading && rankedCount < 300 && <span className="missing-data-note">
                        {300 - rankedCount} distritos sin registro en el archivo fuente
                    </span>}
                </footer>
            </section>

            <style>{`
                .ranking-map-page { min-height:100vh; padding:28px; box-sizing:border-box; background:linear-gradient(150deg,#fff7fb 0%,#f3f6fb 58%,#edf2f8 100%); color:#252936; font-family:Outfit,Inter,system-ui,sans-serif; }
                .ranking-map-card { width:min(1450px,100%); margin:0 auto; padding:26px; box-sizing:border-box; border:1px solid #e3e7ee; border-radius:22px; background:rgba(255,255,255,.94); box-shadow:0 18px 55px rgba(44,50,67,.11); }
                .ranking-map-header { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; margin-bottom:18px; }
                .ranking-map-kicker { color:#d5007f; font-size:.76rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
                .ranking-map-header h1 { margin:5px 0 6px; color:#202331; font-size:clamp(1.55rem,3vw,2.35rem); }
                .ranking-map-header p { margin:0; color:#687083; }
                .ranking-map-summary { min-width:145px; padding:12px 16px; border-radius:14px; background:#fff0f8; text-align:center; }
                .ranking-map-summary strong { display:block; color:#b5006c; font-size:1.7rem; line-height:1; }
                .ranking-map-summary span { color:#76596b; font-size:.75rem; }
                .ranking-map-legend { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:10px 18px; margin:0 auto 15px; color:#555e70; font-size:.8rem; font-weight:700; }
                .ranking-map-legend > span { color:#303544; }
                .ranking-map-legend div,.ranking-map-notes span { display:inline-flex; align-items:center; gap:6px; }
                .ranking-map-legend i { width:19px; height:12px; border:1px solid rgba(0,0,0,.12); border-radius:3px; }
                .ranking-map-canvas { position:relative; overflow:hidden; border:1px solid #dfe5ed; border-radius:18px; background:#fff; }
                .ranking-map-canvas svg { display:block; width:100%; height:auto; min-height:420px; }
                .ranking-district { stroke:#596274; stroke-width:.38; vector-effect:non-scaling-stroke; cursor:crosshair; transition:filter .12s,opacity .12s; }
                .ranking-district:hover { filter:brightness(1.1); stroke:#111827; stroke-width:1.4; }
                .ranking-state-border { stroke:#171b25; stroke-width:1.65; vector-effect:non-scaling-stroke; stroke-linejoin:round; }
                .ranking-map-tooltip { position:absolute; right:15px; bottom:15px; min-width:188px; padding:11px 14px; border:1px solid rgba(255,255,255,.18); border-radius:12px; background:rgba(25,30,42,.91); color:#fff; opacity:.8; pointer-events:none; box-shadow:0 8px 25px rgba(0,0,0,.18); }
                .ranking-map-tooltip.visible { opacity:1; }
                .ranking-map-tooltip span,.ranking-map-tooltip strong,.ranking-map-tooltip em { display:block; }
                .ranking-map-tooltip span { color:#d8dce5; font-size:.76rem; }
                .ranking-map-tooltip strong { margin:2px 0; font-size:1rem; }
                .ranking-map-tooltip em { color:#fff2a8; font-size:.8rem; font-style:normal; }
                .ranking-map-message { position:absolute; z-index:4; inset:0; display:grid; place-items:center; background:rgba(250,252,255,.83); color:#626b7c; font-weight:700; }
                .ranking-map-message.error { position:static; min-height:300px; border-radius:16px; color:#b42318; background:#fff2f0; }
                .ranking-map-notes { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:14px 24px; margin-top:14px; color:#687083; font-size:.78rem; }
                .ranking-map-notes i { display:inline-block; width:24px; height:0; }
                .district-line-sample { border-top:1px solid #596274; }
                .state-line-sample { border-top:3px solid #171b25; }
                .missing-data-note { color:#8a4b08; }
                @media (max-width:720px) { .ranking-map-page{padding:10px}.ranking-map-card{padding:15px;border-radius:16px}.ranking-map-header{display:block}.ranking-map-summary{display:inline-block;margin-top:14px}.ranking-map-canvas{overflow-x:auto}.ranking-map-canvas svg{width:900px;max-width:none}.ranking-map-tooltip{position:sticky;left:12px;width:max-content} }
            `}</style>
        </main>
    );
};

export default MapaRankingDistritos;
