// ============================================
// DISCOS APP - Aniversarios de discos
// ============================================

const APP_KEY = 'mis_discos_app';
const APP_PIN = '1521';

// ============================================
// LOGIN
// ============================================

function checkLogin() {
    return localStorage.getItem('mis_discos_auth') === 'ok';
}

function doLogin() {
    const input = document.getElementById('login-password').value;
    if (input === APP_PIN) {
        localStorage.setItem('mis_discos_auth', 'ok');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-main').classList.remove('hidden');
        init();
    } else {
        document.getElementById('login-error').classList.remove('hidden');
        document.getElementById('login-password').value = '';
        document.getElementById('login-password').focus();
    }
}

// Arranque: ¿está logueado?
if (checkLogin()) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-main').classList.remove('hidden');
} else {
    document.getElementById('btn-login').addEventListener('click', doLogin);
    document.getElementById('login-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });
}

// ============================================
// DATOS Y ESTADO
// ============================================

let discos = JSON.parse(localStorage.getItem(APP_KEY)) || [];
let currentSort = 'aniversario';
let currentFilter = 'todos';
let currentSearch = '';
let cotizacionBlue = null;

// ============================================
// ELEMENTOS DEL DOM
// ============================================

const elements = {
    form: document.getElementById('disco-form'),
    discogsUrl: document.getElementById('discogs-url'),
    btnFetchDiscogs: document.getElementById('btn-fetch-discogs'),
    listaAniversarios: document.getElementById('lista-aniversarios'),
    listaColeccion: document.getElementById('lista-coleccion'),
    notificationBanner: document.getElementById('notification-banner'),
    btnAllowNotif: document.getElementById('btn-allow-notif'),
    btnDenyNotif: document.getElementById('btn-deny-notif'),
    artista: document.getElementById('artista'),
    album: document.getElementById('album'),
    fecha: document.getElementById('fecha'),
    formato: document.getElementById('formato'),
    sello: document.getElementById('sello'),
    genero: document.getElementById('genero'),
    notas: document.getElementById('notas'),
    resena: document.getElementById('resena'),
    fechaAviso: document.getElementById('fecha-aviso'),
    fechaAvisoText: document.querySelector('.fecha-aviso-text'),
    searchArtista: document.getElementById('search-artista'),
    searchAlbum: document.getElementById('search-album'),
    btnSearchWiki: document.getElementById('btn-search-wiki'),
    searchLoading: document.getElementById('search-loading'),
    tapaFile: document.getElementById('tapa-file'),
    btnTapaCamera: document.getElementById('btn-tapa-camera'),
    tapaPreview: document.getElementById('tapa-preview'),
    tapaPreviewImg: document.getElementById('tapa-preview-img'),
    tapaPlaceholder: document.getElementById('tapa-placeholder'),
    tapaRemove: document.getElementById('tapa-remove')
};

let tapaDataUrl = null;

// ============================================
// COTIZACIÓN DÓLAR BLUE
// ============================================

async function fetchCotizacionBlue() {
    const display = document.getElementById('dolar-blue-display');
    const arsDisplay = document.getElementById('precio-ars-display');
    try {
        const resp = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares');
        const data = await resp.json();
        const blueEntries = data.filter(d => d.casa === 'blue');
        const blue = blueEntries[blueEntries.length - 1];
        if (blue && blue.compra) {
            cotizacionBlue = Number(blue.compra);
            console.log('Dólar blue compra cargado:', cotizacionBlue);
            display.textContent = `$${cotizacionBlue.toLocaleString('es-AR')}`;
            const precioUsd = parseFloat(document.getElementById('precio-usd').value);
            if (!isNaN(precioUsd) && precioUsd > 0) {
                arsDisplay.textContent = `$${(precioUsd * cotizacionBlue).toLocaleString('es-AR', {maximumFractionDigits: 0})}`;
            }
        } else {
            display.textContent = 'No disponible';
        }
    } catch (e) {
        console.error('Error fetching cotización:', e);
        display.textContent = 'Error - click ↻';
    }
}

function calcularPrecioArs() {
    const arsDisplay = document.getElementById('precio-ars-display');
    const precioUsd = parseFloat(document.getElementById('precio-usd').value);
    if (!isNaN(precioUsd) && precioUsd > 0 && cotizacionBlue) {
        arsDisplay.textContent = `$${(precioUsd * cotizacionBlue).toLocaleString('es-AR', {maximumFractionDigits: 0})}`;
    } else {
        arsDisplay.textContent = '—';
    }
}

function calcularPrecioArsModal(input) {
    const arsDisplay = document.getElementById('edit-precio-ars-display');
    if (!arsDisplay) return;
    const precioUsd = parseFloat(input.value);
    if (!isNaN(precioUsd) && precioUsd > 0 && cotizacionBlue) {
        arsDisplay.textContent = `$${(precioUsd * cotizacionBlue).toLocaleString('es-AR', {maximumFractionDigits: 0})}`;
    } else {
        arsDisplay.textContent = '—';
    }
}

// ============================================
// UTILIDADES DE IMAGEN
// ============================================

function resizeImage(dataUrl, maxSize = 400) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) { height = height * maxSize / width; width = maxSize; }
            } else {
                if (height > maxSize) { width = width * maxSize / height; height = maxSize; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
    });
}

async function descargarTapa(url) {
    // Usar images.weserv.nl como proxy de imágenes (soporta CORS)
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&output=jpg&q=70`;
    
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('No es imagen');
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('Descarga de tapa falló:', e);
        return null;
    }
}

// ============================================
// UTILIDADES DE FECHA
// ============================================

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parts[1] ? parseInt(parts[1]) - 1 : 0;
    const day = parts[2] ? parseInt(parts[2]) : 1;
    return new Date(year, month, day);
}

function formatDate(date) {
    return date.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function formatDateShort(dateStr) {
    const d = parseDate(dateStr);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function getDiasHastaAniversario(fechaLanzamiento) {
    if (!fechaLanzamiento) return 999;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const fecha = parseDate(fechaLanzamiento);
    const mes = fecha.getMonth();
    const dia = fecha.getDate();
    
    let proximoAniversario = new Date(hoy.getFullYear(), mes, dia);
    
    if (proximoAniversario < hoy) {
        proximoAniversario = new Date(hoy.getFullYear() + 1, mes, dia);
    }
    
    const diff = proximoAniversario - hoy;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getAnniversaryYear(fechaLanzamiento) {
    if (!fechaLanzamiento) return '?';
    
    const hoy = new Date();
    const fecha = parseDate(fechaLanzamiento);
    let anniversaryYear = hoy.getFullYear();
    
    const proximo = new Date(anniversaryYear, fecha.getMonth(), fecha.getDate());
    if (proximo < new Date()) {
        anniversaryYear++;
    }
    
    return anniversaryYear - fecha.getFullYear();
}

// ============================================
// GUARDAR Y CARGAR
// ============================================

function guardarDiscos() {
    localStorage.setItem(APP_KEY, JSON.stringify(discos));
}

function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function discoExiste(album, artista) {
    return discos.some(d => 
        d.album.toLowerCase() === album.toLowerCase() && 
        d.artista.toLowerCase() === artista.toLowerCase()
    );
}

function titleCase(str) {
    if (!str) return str;
    const articles = ['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'a', 'al', 'con', 'por', 'para', 'en', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
    return str.toLowerCase().split(' ').map((word, i) => {
        if (i === 0 || !articles.includes(word)) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
    }).join(' ');
}

function getEstadoClass(estado) {
    if (!estado) return '';
    if (estado.startsWith('M')) return 'estado-mint';
    if (estado.startsWith('NM')) return 'estado-nm';
    if (estado.startsWith('EX')) return 'estado-ex';
    if (estado.startsWith('VG')) return 'estado-vg';
    if (estado.startsWith('G')) return 'estado-g';
    if (estado === 'F') return 'estado-f';
    return 'estado-poor';
}

// ============================================
// WIKIPEDIA API - Para fechas exactas
// ============================================

async function buscarFechaWikipedia(artista, album) {
    // Intentar en español primero, luego en inglés, luego MusicBrainz
    const wikis = [
        { lang: 'es', months: { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' }},
        { lang: 'en', months: { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' }}
    ];
    
    let bestResult = null;
    
    // 1. Intentar Wikipedia (ES → EN)
    for (const wiki of wikis) {
        try {
            const result = await buscarEnWiki(artista, album, wiki.lang, wiki.months);
            if (result && result.fecha) {
                const parts = result.fecha.split('-');
                const isComplete = parts[1] !== '01' || parts[2] !== '01';
                if (isComplete) return result;
                if (!bestResult) bestResult = result;
            }
        } catch (e) {
            console.log(`Error en Wiki ${wiki.lang}:`, e);
        }
    }
    
    // 2. Intentar MusicBrainz
    try {
        const mbResult = await buscarEnMusicBrainz(artista, album);
        if (mbResult && mbResult.fecha) {
            const parts = mbResult.fecha.split('-');
            const isComplete = parts[1] !== '01' || parts[2] !== '01';
            if (isComplete) {
                // Combinar con mejor resultado de Wikipedia (para sello/género)
                return {
                    fecha: mbResult.fecha,
                    sello: bestResult?.sello || null,
                    genero: mbResult.genero || bestResult?.genero || null
                };
            }
            if (!bestResult) bestResult = { fecha: mbResult.fecha, sello: null, genero: mbResult.genero };
        }
    } catch (e) {
        console.log('Error en MusicBrainz:', e);
    }
    
    return bestResult || { fecha: null, sello: null, genero: null };
}

async function buscarEnWiki(artista, album, lang, months) {
    // Buscar con "album" para ser más específico
    const searchQuery = `${artista} ${album} album`;
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&origin=*`;
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) return null;
    
    const searchData = await searchResponse.json();
    if (!searchData.query?.search?.length) return null;
    
    console.log('Wiki search results:', searchData.query.search.map(r => r.title));
    
    // Preferir resultados que coincidan con el nombre del álbum
    let pageTitle = null;
    const albumLower = album.toLowerCase();
    const albumNormalized = albumLower.replace(/\.\.\./g, '…').replace(/…/g, '…');
    
    // Helper: verificar si una página es sobre una persona (no un álbum)
    function esPaginaDePersona(wikitext) {
        return /\|\s*(?:birth_date|nacimiento|born|fecha\s*de\s*nacimiento)\s*=/i.test(wikitext) ||
               /\{\{(?:Ficha de persona|Infobox person|Biografía)/i.test(wikitext);
    }
    
    // Helper: verificar si es página de desambiguación
    function esDesambiguacion(wikitext) {
        return /\{\{[Dd]esambiguaci/.test(wikitext) || /\[\[Desambiguación\]\]/i.test(wikitext);
    }
    
    // Helper: verificar si un título sugiere que es un álbum
    function esTituloDeAlbum(title) {
        const t = title.toLowerCase();
        return t.includes('album') || t.includes('álbum') || t.includes('(álbum') || t.includes('(album');
    }
    
    // Helper: comparar nombres de álbum normalizando ellipsis
    function albumMatch(titulo, busqueda) {
        const t = titulo.toLowerCase().replace(/\.\.\./g, '…');
        const b = busqueda.toLowerCase().replace(/\.\.\./g, '…');
        return t.includes(b) || b.includes(t);
    }
    
    // Filtrar resultados: excluir desambiguaciones
    const searchResults = searchData.query.search.filter(r => {
        const t = r.title.toLowerCase();
        return !t.includes('desambiguación') && !t.includes('(desambiguación)');
    });
    
    // Primero: buscar match exacto en títulos que parezcan álbumes
    for (const result of searchResults) {
        if (albumMatch(result.title, album) && esTituloDeAlbum(result.title)) {
            pageTitle = result.title;
            break;
        }
    }
    
    // Segundo: buscar match exacto sin importar si tiene "album" en título
    if (!pageTitle) {
        for (const result of searchResults) {
            if (albumMatch(result.title, album)) {
                pageTitle = result.title;
                break;
            }
        }
    }
    
    // Tercero: includes con ellipsis normalizado
    if (!pageTitle) {
        for (const result of searchResults) {
            if (albumMatch(result.title, album) && esTituloDeAlbum(result.title)) {
                pageTitle = result.title;
                break;
            }
        }
    }
    
    // Cuarto: último recurso includes
    if (!pageTitle) {
        for (const result of searchResults) {
            if (albumMatch(result.title, album)) {
                pageTitle = result.title;
                break;
            }
        }
    }
    
    if (!pageTitle) return null;
    
    console.log('Wiki page seleccionada:', pageTitle);
    
    // Obtener wikitext Y HTML renderizado
    const pageUrl = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext|text&format=json&origin=*`;
    
    const pageResponse = await fetch(pageUrl);
    if (!pageResponse.ok) return null;
    
    const pageData = await pageResponse.json();
    const wikitext = pageData.parse?.wikitext?.['*'] || '';
    const html = pageData.parse?.text?.['*'] || '';
    
    console.log('Wiki wikitext inicio:', wikitext.substring(0, 300));
    
    // Si la página es desambiguación o sobre una persona, Intentar con el siguiente resultado
    if (esPaginaDePersona(wikitext) || esDesambiguacion(wikitext)) {
        console.log('Wiki página descartada (persona/desambiguación), buscando alternativa...');
        for (const result of searchResults) {
            if (result.title === pageTitle) continue;
            if (albumMatch(result.title, album)) {
                const nextUrl = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(result.title)}&prop=wikitext|text&format=json&origin=*`;
                const nextResp = await fetch(nextUrl);
                if (nextResp.ok) {
                    const nextData = await nextResp.json();
                    const nextWiki = nextData.parse?.wikitext?.['*'] || '';
                    if (!esPaginaDePersona(nextWiki) && !esDesambiguacion(nextWiki)) {
                        return await procesarPagina(nextWiki, nextData.parse?.text?.['*'] || '', artista, album, lang);
                    }
                }
            }
        }
        return null;
    }
    
    let fecha = null;
    let sello = null;
    let genero = null;
    
    return procesarPagina(wikitext, html, artista, album, lang);
}

async function procesarPagina(wikitext, html, artista, album, lang) {
    let fecha = null;
    let sello = null;
    let genero = null;
    
    const allMonths = {
        enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
        julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
        january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };
    
    function extraerFechaDeTexto(text) {
        if (!text || fecha) return;
        for (const [monthName, monthNum] of Object.entries(allMonths)) {
            let m = text.match(new RegExp(`(\\d{1,2})\\s+(?:de\\s+)?${monthName}\\s+(?:de\\s+)?(\\d{4})`, 'i'));
            if (m) { fecha = `${m[2]}-${monthNum}-${m[1].padStart(2, '0')}`; return; }
            m = text.match(new RegExp(`${monthName}\\s+(\\d{1,2}),?\\s*(\\d{4})`, 'i'));
            if (m) { fecha = `${m[2]}-${monthNum}-${m[1].padStart(2, '0')}`; return; }
        }
        const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch && !fecha) fecha = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    
    // === ESTRATEGIA 1: Buscar en wikitext (más confiable, estructura predecible) ===
    const launchMatch = wikitext.match(/\|\s*(?:lanzamiento|publication|release\s*date)\s*=\s*([^\n\}]{5,80})/i);
    if (launchMatch) {
        extraerFechaDeTexto(launchMatch[1]);
        console.log('Estrategia 1 (wikitext lanzamiento):', launchMatch[1].trim(), '→', fecha);
    }
    
    // === ESTRATEGIA 2: Buscar en HTML renderizado ===
    if (!fecha) {
        const cleanHtml = html
            .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
            .replace(/<ref[^>]*\/>/gi, '')
            .replace(/<table[^>]*class="[^"]*ambox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '')
            .replace(/<div[^>]*class="[^"]*ambox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&#91;/g, '[')
            .replace(/&#93;/g, ']');
        
        const infoboxMatch = cleanHtml.match(/(?:lanzamiento|publicaci[oó]n)[^]*?(?=\||\n)/i);
        if (infoboxMatch) {
            extraerFechaDeTexto(infoboxMatch[0]);
            console.log('Estrategia 2 (HTML infobox):', infoboxMatch[0].substring(0, 80), '→', fecha);
        }
        
        if (!fecha) {
            const primerParrafo = cleanHtml.substring(0, 3000);
            extraerFechaDeTexto(primerParrafo);
            console.log('Estrategia 2b (HTML primer párrafo):', fecha);
        }
    }
    
    // === ESTRATEGIA 3: Buscar en wikitext limpiando templates ===
    if (!fecha) {
        const cleanWiki = wikitext
            .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
            .replace(/<ref[^>]*\/>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\{\{[^}]*\|([^{}]*)\}\}/g, '$1')
            .replace(/\{\{[^{}]*\}\}/g, '')
            .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
            .replace(/'''?/g, '');
        
        const releasedMatch = cleanWiki.match(/(?:lanzamiento|released|publicaci[oó]n|date|fecha)\s*[:=]\s*([^\n]{5,80})/i);
        if (releasedMatch) {
            extraerFechaDeTexto(releasedMatch[1]);
            console.log('Estrategia 3 (wikitext limpio):', releasedMatch[1].substring(0, 80), '→', fecha);
        }
    }
    
    // === SELLO ===
    const labelMatch = wikitext.match(/\|\s*(?:label|discografica|discográfica)\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\})/i);
    if (labelMatch) {
        const sellos = [];
        const labelMatches = labelMatch[1].match(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g);
        if (labelMatches) {
            labelMatches.forEach(m => {
                const clean = m.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/, '$2').trim();
                if (clean && !sellos.includes(clean)) sellos.push(clean);
            });
        }
        if (sellos.length === 0) {
            labelMatch[1].split(/[\*\n]/).forEach(l => {
                const clean = l.replace(/\{\{[^}]*\}\}/g, '').trim();
                if (clean.length > 0 && clean.length < 50 && !sellos.includes(clean)) sellos.push(clean);
            });
        }
        if (sellos.length > 0) sello = sellos.join(' / ');
    }
    
    // === GÉNERO ===
    if (!genero) {
        const genreWikitext = wikitext.match(/\|\s*(?:genre|género)\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\})/i);
        if (genreWikitext) {
            const generosEncontrados = [];
            const genreLinkRegex = /\[\[([^\]|]*\|)?([^\]]*)\]\]/g;
            let gm;
            while ((gm = genreLinkRegex.exec(genreWikitext[1])) !== null) {
                const g = gm[2].trim();
                if (g && !generosEncontrados.includes(g)) generosEncontrados.push(g);
            }
            if (generosEncontrados.length === 0) {
                genreWikitext[1].split(/[\*\n]/).forEach(l => {
                    const clean = l.replace(/\{\{[^}]*\}\}/g, '').trim();
                    if (clean.length > 0 && clean.length < 40 && !generosEncontrados.includes(clean)) generosEncontrados.push(clean);
                });
            }
            if (generosEncontrados.length > 0) genero = generosEncontrados.join(', ');
        }
    }
    
    if (!genero) {
        const generosConocidos = [
            'hard rock', 'heavy metal', 'glam metal', 'glam rock', 'pop rock', 'pop', 'rock',
            'blues rock', 'punk rock', 'alternative rock', 'indie rock', 'progressive rock',
            'psychedelic rock', 'folk rock', 'country rock', 'jazz rock', 'fusion', 'funk',
            'soul', 'r&b', 'disco', 'electronic', 'synth pop', 'new wave', 'post punk',
            'grunge', 'metal', 'death metal', 'black metal', 'thrash metal', 'power metal',
            'doom metal', 'stoner rock', 'ska', 'reggae', 'country', 'latin', 'salsa',
            'merengue', 'tango', 'cumbia', 'rock alternativo', 'rock and roll', 'rocksteady',
            'soft rock', 'arena rock', 'glam', 'hair metal', 'speed metal', 'nu metal',
            'industrial', 'gothic rock', 'emo', 'pop punk', 'reggaeton',
            'trip hop', 'downtempo', 'electronica', 'lounge', 'ambient', 'chillout',
            'hip hop', 'rap', 'r&b', 'soul', 'funk', 'disco', 'house', 'techno',
            'drum and bass', 'jungle', 'breakbeat', 'big beat', 'acid jazz'
        ];
        
        const textLower = html.toLowerCase();
        const genresFound = [];
        
        for (const g of generosConocidos) {
            if (textLower.includes(g)) {
                const capitalized = g.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                if (!genresFound.includes(capitalized)) {
                    genresFound.push(capitalized);
                }
            }
        }
        
        if (genresFound.length > 0) {
            genero = genresFound.slice(0, 4).join(', ');
        }
    }
    
    return { fecha, sello, genero };
}

// ============================================
// MUSICBRAINZ API
// ============================================

async function buscarEnMusicBrainz(artista, album) {
    const query = `artist:${artista} AND release:${album}`;
    const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
    
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'DiscosApp/1.0 (discos-app)' }
        });
        if (!response.ok) return null;
        
        const data = await response.json();
        if (!data['release-groups']?.length) return null;
        
        const albumLower = album.toLowerCase();
        const artistLower = artista.toLowerCase();
        
        // Buscar el mejor match: preferir álbumes oficiales sobre compilaciones
        let bestMatch = null;
        let bestScore = -1;
        
        for (const rg of data['release-groups']) {
            const titleLower = rg.title.toLowerCase();
            const rgArtist = rg['artist-credit']?.[0]?.name?.toLowerCase() || '';
            
            // Solo álbumes primarios (no compilaciones, no live, etc.)
            if (rg['primary-type'] !== 'Album') continue;
            if (rg['secondary-types']?.length > 0) continue;
            
            // Calcular score de coincidencia
            let score = 0;
            if (titleLower === albumLower) score += 100;
            else if (titleLower.includes(albumLower) || albumLower.includes(titleLower)) score += 50;
            else continue;
            
            if (rgArtist.includes(artistLower) || artistLower.includes(rgArtist)) score += 30;
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = rg;
            }
        }
        
        // Si no encontró album primario, tomar el primero con score alto
        if (!bestMatch) {
            for (const rg of data['release-groups']) {
                const titleLower = rg.title.toLowerCase();
                if (rg['primary-type'] !== 'Album') continue;
                if (titleLower === albumLower || titleLower.includes(albumLower) || albumLower.includes(titleLower)) {
                    bestMatch = rg;
                    break;
                }
            }
        }
        
        if (!bestMatch || !bestMatch['first-release-date']) return null;
        
        const dateStr = bestMatch['first-release-date'];
        let fecha = null;
        
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            fecha = dateStr;
        } else if (/^\d{4}-\d{2}$/.test(dateStr)) {
            fecha = `${dateStr}-01`;
        } else if (/^\d{4}$/.test(dateStr)) {
            fecha = `${dateStr}-01-01`;
        }
        
        // Extraer tags como género
        const generos = (bestMatch.tags || [])
            .filter(t => t.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(t => t.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
            .join(', ');
        
        console.log('MusicBrainz:', bestMatch.title, fecha, generos);
        
        return { fecha, genero: generos || null };
        
    } catch (e) {
        console.error('Error MusicBrainz:', e);
        return null;
    }
}

// ============================================
// DISCOGS API
// ============================================

function extraerIdDiscogs(url) {
    const matchRelease = url.match(/\/release\/(\d+)/);
    const matchMaster = url.match(/\/master\/(\d+)/);
    
    if (matchRelease) {
        return { tipo: 'release', id: matchRelease[1] };
    } else if (matchMaster) {
        return { tipo: 'master', id: matchMaster[1] };
    }
    return null;
}

async function fetchDiscogs(endpoint) {
    const url = `https://api.discogs.com${endpoint}`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'MisDiscosApp/1.0' }
    });
    if (!response.ok) throw new Error(`Discogs API error: ${response.status}`);
    return response.json();
}

async function buscarEnDiscogs(url) {
    const info = extraerIdDiscogs(url);
    if (!info) {
        alert('Link de Discogs no válido. Debe contener /release/ o /master/');
        return null;
    }
    
    try {
        let data;
        
        if (info.tipo === 'release') {
            data = await fetchDiscogs(`/releases/${info.id}`);
        } else {
            data = await fetchDiscogs(`/masters/${info.id}`);
        }
        
        const artistaNombre = data.artists?.map(a => a.name).join(', ') || '';
        const albumNombre = data.title || '';
        console.log('Discogs date_released:', data.date_released, '| year:', data.year);
        const fechaRelease = data.year ? `${data.year}-01-01` : '';
        
        // Obtener género de Discogs
        const generos = data.genres || [];
        const estilos = data.styles || [];
        const generoDiscogs = [...generos, ...estilos].join(', ');
        
        // Obtener tapa de Discogs (imagen primaria)
        let tapaDiscogs = null;
        if (data.images && data.images.length > 0) {
            const imgPrincipal = data.images.find(img => img.type === 'primary') || data.images[0];
            tapaDiscogs = await descargarTapa(imgPrincipal.uri);
        }
        
        // Buscar datos en Wikipedia (fecha, sello, género)
        let datosWiki = { fecha: null, sello: null, genero: null };
        if (artistaNombre && albumNombre) {
            datosWiki = await buscarFechaWikipedia(artistaNombre, albumNombre);
        }
        
        // Extraer fecha de fabricación de las notas de Discogs (glass master date)
        let fechaFabricacion = null;
        let discogsNotes = data.notes || '';
        
        // Si no vienen las notas de la API, intentar obtener la página vía proxy
        if (!discogsNotes && info.tipo === 'release') {
            try {
                const pageUrl = `https://www.discogs.com/release/${info.id}`;
                const proxyResp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(pageUrl)}`);
                const pageHtml = await proxyResp.text();
                const notesSection = pageHtml.match(/Notes[\s\S]{0,200}<\/h4>([\s\S]{0,2000}?)<(?:div|table|section)/i);
                if (notesSection) {
                    discogsNotes = notesSection[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
                }
            } catch (e) { /* fallback silencioso */ }
        }
        
        if (discogsNotes) {
            const glassMatch = discogsNotes.match(/glass\s*master\s*date:\s*(\w+\s+\d{1,2},?\s*\d{4})/i);
            if (glassMatch) {
                const parsed = new Date(glassMatch[1]);
                if (!isNaN(parsed.getTime())) {
                    fechaFabricacion = parsed.getFullYear().toString();
                }
            }
        }
        
        const disco = {
            artista: artistaNombre,
            album: albumNombre,
            fecha: datosWiki.fecha || fechaRelease,
            anioEdicion: fechaFabricacion || data.year?.toString() || '',
            formato: 'vinilo',
            formatoDetalle: '',
            sello: datosWiki.sello || data.labels?.[0]?.name || '',
            genero: datosWiki.genero || generoDiscogs,
            runout: '',
            catalogo: data.labels?.[0]?.catno || '',
            barcode: '',
            notas: discogsNotes || '',
            discogsUrl: url,
            discogsId: info.id,
            tapa: tapaDiscogs || ''
        };
        
        // Extraer identifiers
        if (data.identifiers) {
            for (const id of data.identifiers) {
                const type = (id.type || '').toLowerCase();
                if (type.includes('matrix') || type.includes('runout')) {
                    if (id.value && !disco.runout) disco.runout = id.value;
                } else if (type.includes('barcode')) {
                    if (id.value && !disco.barcode) disco.barcode = id.value;
                } else if (type.includes('catalog')) {
                    if (id.value && !disco.catalogo) disco.catalogo = id.value;
                }
            }
        }
        
        // Detectar formato y detalle (ej: "2 x Vinyl, LP, Album")
        let formatoDetalle = '';
        if (data.formats?.[0]) {
            const fmt = data.formats[0];
            const qty = fmt.qty || '1';
            const name = fmt.name || '';
            const descs = fmt.descriptions || [];
            formatoDetalle = [`${qty} x ${name}`, ...descs].join(', ');
            
            const formatName = name.toLowerCase();
            if (formatName.includes('cd')) disco.formato = 'cd';
            else if (formatName.includes('cassette')) disco.formato = 'cassette';
            else if (formatName.includes('vinyl') || formatName.includes('vinilo')) disco.formato = 'vinilo';
        }
        disco.formatoDetalle = formatoDetalle;
        
        return disco;
        
    } catch (error) {
        console.error('Error en Discogs:', error);
        alert('Error al buscar el disco. Verificá el link.');
        return null;
    }
}

// ============================================
// RENDERIZADO
// ============================================

function renderAniversarios() {
    const discosConDias = discos.map(disco => ({
        ...disco,
        dias: getDiasHastaAniversario(disco.fecha)
    })).sort((a, b) => a.dias - b.dias);
    
    if (discosConDias.length === 0) {
        elements.listaAniversarios.innerHTML = '<p class="empty-message">No tenés discos cargados todavía.</p>';
        return;
    }
    
    elements.listaAniversarios.innerHTML = discosConDias.map(disco => {
        const anniversaryYear = getAnniversaryYear(disco.fecha);
        let claseCard = '';
        let claseDias = 'lejano';
        let textoDias = `${disco.dias} días`;
        
        if (disco.dias === 0) {
            claseCard = 'hoy';
            claseDias = 'hoy';
            textoDias = '¡HOY!';
        } else if (disco.dias === 1) {
            claseCard = 'manana';
            claseDias = 'proximo';
            textoDias = '¡MAÑANA!';
        } else if (disco.dias <= 7) {
            claseDias = 'proximo';
        }
        
        return `
            <div class="anniversary-card ${claseCard}">
                <div class="anniversary-header">
                    ${disco.tapa ? `<img class="anniversary-tapa" src="${disco.tapa}" alt="Tapa">` : ''}
                    <div>
                        <h3>${titleCase(disco.album)}</h3>
                        <span class="dias-badge ${claseDias}">${textoDias}</span>
                    </div>
                </div>
                <div class="anniversary-details">
                    <span class="artista">${titleCase(disco.artista)}</span> · 
                    ${anniversaryYear}° aniversario · 
                    ${formatDateShort(disco.fecha)}${disco.fecha && disco.fecha.endsWith('-01-01') ? ' <span class="fecha-badge-alert" title="Fecha no verificada — solo año conocido">⚠</span>' : ''}
                    ${disco.sello ? ` · ${disco.sello}` : ''}
                    ${disco.formatoDetalle ? ` · ${disco.formatoDetalle}` : ''}
                </div>
                ${disco.genero ? `<div class="anniversary-genre">${disco.genero}</div>` : ''}
                ${disco.notas ? `<div class="anniversary-note">"${disco.notas}"</div>` : ''}
            </div>
        `;
    }).join('');
}

function renderColeccion(filtro) {
    if (filtro) currentFilter = filtro;
    let discosFiltrados = [...discos];

    if (currentFilter !== 'todos') {
        discosFiltrados = discosFiltrados.filter(d => d.formato === currentFilter);
    }

    if (currentSearch) {
        const term = currentSearch.toLowerCase();
        discosFiltrados = discosFiltrados.filter(d =>
            d.artista.toLowerCase().includes(term) ||
            d.album.toLowerCase().includes(term)
        );
    }

    switch (currentSort) {
        case 'aniversario':
            discosFiltrados.sort((a, b) => getDiasHastaAniversario(a.fecha) - getDiasHastaAniversario(b.fecha));
            break;
        case 'reciente':
            discosFiltrados.reverse();
            break;
        case 'banda':
            discosFiltrados.sort((a, b) => a.artista.localeCompare(b.artista, 'es'));
            break;
        case 'album':
            discosFiltrados.sort((a, b) => a.album.localeCompare(b.album, 'es'));
            break;
        case 'anio':
            discosFiltrados.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
            break;
    }
    
    if (discosFiltrados.length === 0) {
        elements.listaColeccion.innerHTML = '<p class="empty-message">Vacío... ¿Empezamos?</p>';
        return;
    }
    
    elements.listaColeccion.innerHTML = discosFiltrados.map(disco => {
        const anniversaryYear = getAnniversaryYear(disco.fecha);
        const fechaStr = formatDateShort(disco.fecha);
        const fechaUnreliable = disco.fecha && disco.fecha.endsWith('-01-01');
        const parts = [];
        if (fechaStr) parts.push(fechaStr + (fechaUnreliable ? ' <span class="fecha-badge-alert" title="Fecha no verificada — solo año conocido">⚠</span>' : ''));
        if (disco.anioEdicion) parts.push(`Ed. ${disco.anioEdicion}`);
        if (disco.sello) parts.push(disco.sello);
        if (disco.genero) parts.push(disco.genero);
        if (disco.formatoDetalle) parts.push(disco.formatoDetalle);

        return `
            <div class="disco-card" onclick="editarDisco('${disco.id}')">
                ${disco.tapa ? `<img class="disco-tapa-mini" src="${disco.tapa}" alt="Tapa" loading="lazy">` : '<div class="disco-tapa-mini disco-tapa-placeholder">🎵</div>'}
                <div class="disco-info">
                    <div class="disco-title-row">
                        <h3>${titleCase(disco.album)}</h3>
                        <span class="formato-badge ${disco.formato}">${disco.formato}</span>
                    </div>
                    <div class="artista">${titleCase(disco.artista)}</div>
                    <div class="fecha">${parts.join(' · ')}</div>
                    <div class="disco-badges">
                        ${disco.precioUsd ? `<span class="precio-badge">$${parseFloat(disco.precioUsd).toLocaleString('es-AR', {minimumFractionDigits: 2})} USD</span>` : ''}
                        ${disco.estadoTapa ? `<span class="mini-badge tapa-badge">Tapa: ${disco.estadoTapa}</span>` : ''}
                        ${disco.estado ? `<span class="mini-badge estado-badge ${getEstadoClass(disco.estado)}">${disco.estado}</span>` : ''}
                        ${disco.tieneInsert === 'si' ? '<span class="mini-badge insert-badge">INS</span>' : ''}
                        ${disco.catalogo ? `<span class="mini-badge cat-badge">${disco.catalogo}</span>` : ''}
                    </div>
                </div>
                <button class="disco-delete-btn" onclick="event.stopPropagation(); eliminarDisco('${disco.id}')" title="Eliminar">✕</button>
            </div>
        `;
    }).join('');
}

function renderAll() {
    renderAniversarios();
    renderColeccion();
}

// ============================================
// ACCIONES
// ============================================

function agregarDisco(disco) {
    // Verificar si ya existe
    if (discoExiste(disco.album, disco.artista)) {
        alert(`"${disco.album}" de ${disco.artista} ya está en tu colección.`);
        return false;
    }
    
    disco.id = generarId();
    disco.fechaAgregado = new Date().toISOString();
    discos.push(disco);
    guardarDiscos();
    renderAll();
    return true;
}

function eliminarDisco(id) {
    if (!confirm('¿Eliminar este disco de tu colección?')) return;
    discos = discos.filter(d => d.id !== id);
    guardarDiscos();
    renderAll();
}

function editarDisco(id) {
    const disco = discos.find(d => d.id === id);
    if (!disco) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Editar disco</h3>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="tapa-preview-modal" id="edit-tapa-container">
                    ${disco.tapa ? `<img id="edit-tapa-img" src="${disco.tapa}" alt="Tapa">` : '<div class="tapa-placeholder" style="width:100%;height:140px"><span class="tapa-icon">📷</span><p>Sin tapa</p></div>'}
                </div>
                <div class="tapa-buttons" style="justify-content:center;margin-bottom:12px">
                    <label class="btn-secondary tapa-btn">
                        📁 Cambiar tapa
                        <input type="file" id="edit-tapa-file" accept="image/*" hidden>
                    </label>
                    <button type="button" class="btn-secondary tapa-btn" id="edit-tapa-camera">📸 Tomar foto</button>
                    ${disco.tapa ? '<button type="button" class="btn-secondary tapa-btn" id="edit-tapa-remove">✕ Quitar tapa</button>' : ''}
                </div>
                <div class="form-group">
                    <label>Artista / Banda</label>
                    <input type="text" id="edit-artista" value="${disco.artista}">
                </div>
                <div class="form-group">
                    <label>Álbum / Disco</label>
                    <input type="text" id="edit-album" value="${disco.album}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Fecha de lanzamiento</label>
                        <div class="fecha-input-row">
                            <input type="date" id="edit-fecha" value="${disco.fecha}">
                            ${disco.fecha && disco.fecha.endsWith('-01-01') ? '<span class="fecha-alert" title="Fecha no verificada — solo año conocido">⚠</span>' : ''}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Año de edición</label>
                        <input type="number" id="edit-anio-edicion" value="${disco.anioEdicion || ''}" placeholder="Ej: 1982" min="1900" max="2099">
                    </div>
                    <div class="form-group">
                        <label>Formato</label>
                        <select id="edit-formato">
                            <option value="vinilo" ${disco.formato === 'vinilo' ? 'selected' : ''}>Vinilo</option>
                            <option value="cd" ${disco.formato === 'cd' ? 'selected' : ''}>CD</option>
                            <option value="cassette" ${disco.formato === 'cassette' ? 'selected' : ''}>Cassette</option>
                            <option value="otro" ${disco.formato === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Ejemplares / Detalle</label>
                        <input type="text" id="edit-formato-detalle" value="${disco.formatoDetalle || ''}" placeholder="2 x Vinyl, LP">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Sello discográfico</label>
                        <input type="text" id="edit-sello" value="${disco.sello || ''}">
                    </div>
                    <div class="form-group">
                        <label>Género</label>
                        <input type="text" id="edit-genero" value="${disco.genero || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Estado (Goldmine)</label>
                    <select id="edit-estado">
                        <option value="" ${!disco.estado ? 'selected' : ''}>Sin calificar</option>
                        <option value="M" ${disco.estado === 'M' ? 'selected' : ''}>M - Mint</option>
                        <option value="NM" ${disco.estado === 'NM' ? 'selected' : ''}>NM - Near Mint</option>
                        <option value="NM-" ${disco.estado === 'NM-' ? 'selected' : ''}>NM- - Near Mint Minus</option>
                        <option value="EX+" ${disco.estado === 'EX+' ? 'selected' : ''}>EX+ - Excellent Plus</option>
                        <option value="EX" ${disco.estado === 'EX' ? 'selected' : ''}>EX - Excellent</option>
                        <option value="EX-" ${disco.estado === 'EX-' ? 'selected' : ''}>EX- - Excellent Minus</option>
                        <option value="VG+" ${disco.estado === 'VG+' ? 'selected' : ''}>VG+ - Very Good Plus</option>
                        <option value="VG" ${disco.estado === 'VG' ? 'selected' : ''}>VG - Very Good</option>
                        <option value="VG-" ${disco.estado === 'VG-' ? 'selected' : ''}>VG- - Very Good Minus</option>
                        <option value="G+" ${disco.estado === 'G+' ? 'selected' : ''}>G+ - Good Plus</option>
                        <option value="G" ${disco.estado === 'G' ? 'selected' : ''}>G - Good</option>
                        <option value="G-" ${disco.estado === 'G-' ? 'selected' : ''}>G- - Good Minus</option>
                        <option value="F" ${disco.estado === 'F' ? 'selected' : ''}>F - Fair</option>
                        <option value="P" ${disco.estado === 'P' ? 'selected' : ''}>P - Poor</option>
                        <option value="X" ${disco.estado === 'X' ? 'selected' : ''}>X - Junk</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tapa</label>
                        <select id="edit-estado-tapa">
                            <option value="" ${!disco.estadoTapa ? 'selected' : ''}>Sin calificar</option>
                            <option value="M" ${disco.estadoTapa === 'M' ? 'selected' : ''}>M - Mint</option>
                            <option value="NM" ${disco.estadoTapa === 'NM' ? 'selected' : ''}>NM - Near Mint</option>
                            <option value="EX" ${disco.estadoTapa === 'EX' ? 'selected' : ''}>EX - Excelente</option>
                            <option value="VG" ${disco.estadoTapa === 'VG' ? 'selected' : ''}>VG - Buen estado</option>
                            <option value="G" ${disco.estadoTapa === 'G' ? 'selected' : ''}>G - Desgaste</option>
                            <option value="F" ${disco.estadoTapa === 'F' ? 'selected' : ''}>F - Muy deteriorada</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>¿Tiene insert?</label>
                        <select id="edit-tiene-insert">
                            <option value="no" ${disco.tieneInsert !== 'si' ? 'selected' : ''}>No</option>
                            <option value="si" ${disco.tieneInsert === 'si' ? 'selected' : ''}>Sí</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Notas / Dato curioso</label>
                    <textarea id="edit-notas">${disco.notas || ''}</textarea>
                </div>
                <div class="form-section-label">Datos de edición (Discogs)</div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Matrix / Runout</label>
                        <input type="text" id="edit-runout" value="${disco.runout || ''}">
                    </div>
                    <div class="form-group">
                        <label>Nº de catálogo</label>
                        <input type="text" id="edit-catalogo" value="${disco.catalogo || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Barcode</label>
                        <input type="text" id="edit-barcode" value="${disco.barcode || ''}">
                    </div>
                    <div class="form-group">
                        <label>Link Discogs</label>
                        <input type="text" id="edit-discogs-url" value="${disco.discogsUrl || ''}">
                    </div>
                </div>
                <div class="form-section-label">Precio</div>
                <div class="form-row-3">
                    <div class="form-group">
                        <label>Precio (USD)</label>
                        <input type="number" id="edit-precio-usd" step="0.01" min="0" value="${disco.precioUsd || ''}" oninput="calcularPrecioArsModal(this)">
                    </div>
                    <div class="form-group">
                        <label>Dólar blue compra</label>
                        <div class="dolar-display" style="overflow:visible;white-space:nowrap">${disco.cotizacionBlue ? '$' + disco.cotizacionBlue.toLocaleString('es-AR') : (cotizacionBlue ? '$' + cotizacionBlue.toLocaleString('es-AR') : 'Cargando...')}</div>
                    </div>
                    <div class="form-group">
                        <label>Equivalente en ARS</label>
                        <div class="dolar-display ars" id="edit-precio-ars-display">${(disco.precioUsd && disco.cotizacionBlue) ? '$' + (disco.precioUsd * disco.cotizacionBlue).toLocaleString('es-AR', {maximumFractionDigits: 0}) : '—'}</div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Reseña personal</label>
                    <textarea id="edit-resena" placeholder="Tu opinión sobre el disco...">${disco.resena || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="modal-cancel">Cancelar</button>
                <button class="btn-primary" id="modal-save">Guardar cambios</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    let editTapaUrl = disco.tapa || null;

    const editTapaFile = modal.querySelector('#edit-tapa-file');
    if (editTapaFile) {
        editTapaFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                editTapaUrl = await resizeImage(ev.target.result);
                const container = modal.querySelector('#edit-tapa-container');
                container.innerHTML = `<img id="edit-tapa-img" src="${editTapaUrl}" alt="Tapa">`;
            };
            reader.readAsDataURL(file);
        });
    }

    const editTapaRemove = modal.querySelector('#edit-tapa-remove');
    if (editTapaRemove) {
        editTapaRemove.addEventListener('click', () => {
            editTapaUrl = null;
            const container = modal.querySelector('#edit-tapa-container');
            container.innerHTML = '<div class="tapa-placeholder" style="width:100%;height:140px"><span class="tapa-icon">📷</span><p>Sin tapa</p></div>';
        });
    }

    const editTapaCamera = modal.querySelector('#edit-tapa-camera');
    if (editTapaCamera) {
        editTapaCamera.addEventListener('click', () => {
            abrirWebcam((dataUrl) => {
                editTapaUrl = dataUrl;
                const container = modal.querySelector('#edit-tapa-container');
                container.innerHTML = `<img id="edit-tapa-img" src="${dataUrl}" alt="Tapa">`;
            });
        });
    }

    modal.querySelector('#modal-save').addEventListener('click', () => {
        disco.artista = modal.querySelector('#edit-artista').value.trim();
        disco.album = modal.querySelector('#edit-album').value.trim();
        disco.fecha = modal.querySelector('#edit-fecha').value;
        disco.anioEdicion = modal.querySelector('#edit-anio-edicion').value || '';
        disco.formato = modal.querySelector('#edit-formato').value;
        disco.formatoDetalle = modal.querySelector('#edit-formato-detalle').value.trim();
        disco.sello = modal.querySelector('#edit-sello').value.trim();
        disco.genero = modal.querySelector('#edit-genero').value.trim();
        disco.estado = modal.querySelector('#edit-estado').value;
        disco.estadoTapa = modal.querySelector('#edit-estado-tapa').value;
        disco.tieneInsert = modal.querySelector('#edit-tiene-insert').value;
        disco.runout = modal.querySelector('#edit-runout').value.trim();
        disco.catalogo = modal.querySelector('#edit-catalogo').value.trim();
        disco.barcode = modal.querySelector('#edit-barcode').value.trim();
        disco.discogsUrl = modal.querySelector('#edit-discogs-url').value.trim();
        disco.precioUsd = modal.querySelector('#edit-precio-usd').value || '';
        disco.cotizacionBlue = disco.cotizacionBlue || cotizacionBlue || '';
        disco.notas = modal.querySelector('#edit-notas').value.trim();
        disco.resena = modal.querySelector('#edit-resena').value.trim();
        disco.tapa = editTapaUrl || '';

        if (!disco.artista || !disco.album || !disco.fecha) {
            alert('Completá artista, álbum y fecha');
            return;
        }

        guardarDiscos();
        renderAll();
        modal.remove();
    });
}

function toggleResena(id) {
    const el = document.getElementById(`resena-${id}`);
    if (el) el.classList.toggle('hidden');
}

function copiarResena(id) {
    const disco = discos.find(d => d.id === id);
    if (!disco || !disco.resena) return;
    navigator.clipboard.writeText(disco.resena).then(() => {
        const btn = document.getElementById(`copy-${id}`);
        btn.textContent = 'Copiado!';
        setTimeout(() => btn.textContent = 'Copiar', 1500);
    });
}

function limpiarFormulario() {
    elements.form.reset();
    elements.searchArtista.value = '';
    elements.searchAlbum.value = '';
    elements.fechaAviso.classList.add('hidden');
    elements.resena.value = '';
    document.getElementById('estado').value = '';
    document.getElementById('estado-tapa').value = '';
    document.getElementById('tiene-insert').value = 'no';
    document.getElementById('anio-edicion').value = '';
    document.getElementById('formato-detalle').value = '';
    document.getElementById('runout').value = '';
    document.getElementById('catalogo').value = '';
    document.getElementById('barcode').value = '';
    document.getElementById('discogs-url-edit').value = '';
    document.getElementById('precio-usd').value = '';
    document.getElementById('precio-ars-display').textContent = '—';
    tapaDataUrl = null;
    elements.tapaPreview.classList.add('hidden');
    elements.tapaPlaceholder.classList.remove('hidden');
    elements.tapaFile.value = '';
}

// ============================================
// NOTIFICACIONES IN-APP (TOAST CON TAPA)
// ============================================

function showToast(disco, tipo) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    const tapaHtml = disco.tapa
        ? `<img class="toast-tapa" src="${disco.tapa}" alt="Tapa">`
        : `<div class="toast-tapa-placeholder">🎵</div>`;
    
    let title, detail;
    if (tipo === 'hoy') {
        title = '¡HOY cumple años!';
        detail = '¡Prepará tu posteo!';
    } else if (tipo === 'manana') {
        title = '¡MAÑANA cumple años!';
        detail = '¿Ya tenés la foto lista?';
    } else {
        const anio = disco.anio || getAnniversaryYear(disco.fecha);
        title = `${anio}° aniversario`;
        detail = `Faltan ${disco.dias} día${disco.dias !== 1 ? 's' : ''}`;
    }
    
    toast.innerHTML = `
        ${tapaHtml}
        <div class="toast-body">
            <div class="toast-title">${titleCase(disco.album)}</div>
            <div class="toast-artist">${titleCase(disco.artista)}</div>
            <div class="toast-detail">${detail}</div>
        </div>
    `;
    
    toast.addEventListener('click', () => {
        toast.classList.add('salir');
        setTimeout(() => toast.remove(), 300);
    });
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('salir');
            setTimeout(() => toast.remove(), 300);
        }
    }, 8000);
}

function verificarNotificacionesHoy() {
    discos.forEach(disco => {
        const dias = getDiasHastaAniversario(disco.fecha);
        if (dias === 0) {
            showToast(disco, 'hoy');
        } else if (dias === 1) {
            showToast(disco, 'manana');
        }
    });
}

function verificarPermisosNotificacion() {
    elements.notificationBanner.classList.add('hidden');
}

function pedirPermisoNotificacion() {
    elements.notificationBanner.classList.add('hidden');
}

// ============================================
// EVENT LISTENERS
// ============================================

// Tapa - selección de imagen
function handleTapaFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        tapaDataUrl = await resizeImage(e.target.result);
        elements.tapaPreviewImg.src = tapaDataUrl;
        elements.tapaPreview.classList.remove('hidden');
        elements.tapaPlaceholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

elements.tapaFile.addEventListener('change', (e) => {
    handleTapaFile(e.target.files[0]);
});

elements.tapaRemove.addEventListener('click', () => {
    tapaDataUrl = null;
    elements.tapaPreview.classList.add('hidden');
    elements.tapaPlaceholder.classList.remove('hidden');
    elements.tapaFile.value = '';
});

// Webcam
let webcamStream = null;

function abrirWebcam(onCapture) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="webcam-modal">
            <div class="modal-header">
                <h3>Tomar foto</h3>
                <button class="modal-close" id="webcam-close">&times;</button>
            </div>
            <div class="webcam-video-container">
                <video id="webcam-video" autoplay playsinline></video>
                <canvas id="webcam-canvas"></canvas>
            </div>
            <button class="webcam-capture-btn" id="webcam-capture" title="Capturar"></button>
            <button class="webcam-switch-btn" id="webcam-switch">Cambiar cámara</button>
        </div>
    `;
    document.body.appendChild(modal);

    const video = modal.querySelector('#webcam-video');
    const canvas = modal.querySelector('#webcam-canvas');
    let facingMode = 'environment';

    async function startCamera() {
        if (webcamStream) {
            webcamStream.getTracks().forEach(t => t.stop());
        }
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode, aspectRatio: { ideal: 1 } },
                audio: false
            });
            video.srcObject = webcamStream;
        } catch (err) {
            console.error('Error cámara:', err);
            modal.querySelector('.webcam-video-container').innerHTML =
                '<div class="webcam-error">No se pudo acceder a la cámara.<br>Probá con "Elegir archivo" en su lugar.</div>';
            modal.querySelector('#webcam-capture').style.display = 'none';
            modal.querySelector('#webcam-switch').style.display = 'none';
        }
    }

    startCamera();

    modal.querySelector('#webcam-capture').addEventListener('click', async () => {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const size = Math.min(vw, vh);
        const sx = (vw - size) / 2;
        const sy = (vh - size) / 2;
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(video, sx, sy, size, size, 0, 0, size, size);
        const dataUrl = await resizeImage(canvas.toDataURL('image/jpeg', 0.8));
        if (onCapture) {
            onCapture(dataUrl);
        } else {
            tapaDataUrl = dataUrl;
            elements.tapaPreviewImg.src = dataUrl;
            elements.tapaPreview.classList.remove('hidden');
            elements.tapaPlaceholder.classList.add('hidden');
        }
        closeModal();
    });

    modal.querySelector('#webcam-switch').addEventListener('click', () => {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        startCamera();
    });

    function closeModal() {
        if (webcamStream) {
            webcamStream.getTracks().forEach(t => t.stop());
            webcamStream = null;
        }
        modal.remove();
    }

    modal.querySelector('#webcam-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

elements.btnTapaCamera.addEventListener('click', abrirWebcam);

// Búsqueda en Wikipedia
elements.btnSearchWiki.addEventListener('click', async () => {
    const artista = elements.searchArtista.value.trim();
    const album = elements.searchAlbum.value.trim();
    
    if (!artista || !album) {
        alert('Escribí el nombre de la banda y del disco');
        return;
    }
    
    elements.btnSearchWiki.disabled = true;
    elements.btnSearchWiki.textContent = 'Buscando...';
    elements.searchLoading.classList.remove('hidden');
    
    try {
        const datos = await buscarFechaWikipedia(artista, album);
        
        // Llenar el formulario
        elements.artista.value = titleCase(artista);
        elements.album.value = titleCase(album);
        
        if (datos.fecha) {
            elements.fecha.value = datos.fecha;
            verificarFechaAlerta();
        } else {
            alert('No encontré la fecha. Ingresala manualmente.');
            elements.fecha.focus();
        }
        
        if (datos.sello) {
            elements.sello.value = datos.sello;
        }
        
        if (datos.genero) {
            elements.genero.value = datos.genero;
        }
        
        if (datos.fecha) {
            alert(`Datos encontrados:\nFecha: ${formatDateShort(datos.fecha)}\nSello: ${datos.sello || 'No encontrado'}\nGénero: ${datos.genero || 'No encontrado'}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al buscar. Intentá de nuevo.');
    } finally {
        elements.btnSearchWiki.disabled = false;
        elements.btnSearchWiki.textContent = 'Buscar fecha';
        elements.searchLoading.classList.add('hidden');
    }
});

// Buscar en Discogs
elements.btnFetchDiscogs.addEventListener('click', async () => {
    const url = elements.discogsUrl.value.trim();
    if (!url) {
        alert('Pegá un link de Discogs');
        return;
    }
    
    elements.btnFetchDiscogs.disabled = true;
    elements.btnFetchDiscogs.textContent = 'Buscando...';
    
    try {
        const disco = await buscarEnDiscogs(url);
        if (disco) {
            elements.artista.value = titleCase(disco.artista);
            elements.album.value = titleCase(disco.album);
            elements.fecha.value = disco.fecha;
            verificarFechaAlerta();
            if (disco.anioEdicion) document.getElementById('anio-edicion').value = disco.anioEdicion;
            elements.formato.value = disco.formato;
            if (disco.formatoDetalle) document.getElementById('formato-detalle').value = disco.formatoDetalle;
            elements.sello.value = disco.sello;
            if (disco.genero) elements.genero.value = disco.genero;
            if (disco.runout) document.getElementById('runout').value = disco.runout;
            if (disco.catalogo) document.getElementById('catalogo').value = disco.catalogo;
            if (disco.barcode) document.getElementById('barcode').value = disco.barcode;
            document.getElementById('discogs-url-edit').value = url;
            if (disco.notas) elements.notas.value = disco.notas.substring(0, 500);
            
            // Mostrar tapa descargada de Discogs
            if (disco.tapa) {
                tapaDataUrl = disco.tapa;
                elements.tapaPreviewImg.src = tapaDataUrl;
                elements.tapaPreview.classList.remove('hidden');
                elements.tapaPlaceholder.classList.add('hidden');
            }
            
            elements.discogsUrl.value = '';
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        elements.btnFetchDiscogs.disabled = false;
        elements.btnFetchDiscogs.textContent = 'Buscar en Discogs';
    }
});

// Formulario
elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const disco = {
        artista: elements.artista.value.trim(),
        album: elements.album.value.trim(),
        fecha: elements.fecha.value,
        anioEdicion: document.getElementById('anio-edicion').value || '',
        formato: elements.formato.value,
        formatoDetalle: document.getElementById('formato-detalle').value.trim(),
        sello: elements.sello.value.trim(),
        genero: elements.genero.value.trim(),
        estado: document.getElementById('estado').value,
        estadoTapa: document.getElementById('estado-tapa').value,
        tieneInsert: document.getElementById('tiene-insert').value,
        runout: document.getElementById('runout').value.trim(),
        catalogo: document.getElementById('catalogo').value.trim(),
        barcode: document.getElementById('barcode').value.trim(),
        discogsUrl: document.getElementById('discogs-url-edit').value.trim(),
        precioUsd: document.getElementById('precio-usd').value || '',
        cotizacionBlue: cotizacionBlue || '',
        notas: elements.notas.value.trim(),
        resena: elements.resena.value.trim(),
        tapa: tapaDataUrl || ''
    };
    
    if (!disco.artista || !disco.album || !disco.fecha) {
        alert('Completá artista, álbum y fecha');
        return;
    }
    
    const agregado = agregarDisco(disco);
    if (agregado) {
        limpiarFormulario();
        navegarA('screen-aniversarios');
    }
});

// Filtros
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderColeccion(btn.dataset.filter);
    });
});

// Ordenamiento
document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        renderColeccion();
    });
});

// Búsqueda en colección
document.getElementById('buscar-coleccion').addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    renderColeccion();
});

// Alerta de fecha poco fiable (solo año)
function verificarFechaAlerta() {
    const fecha = document.getElementById('fecha').value;
    const alerta = document.getElementById('fecha-alert');
    if (fecha && fecha.endsWith('-01-01')) {
        alerta.classList.remove('hidden');
    } else {
        alerta.classList.add('hidden');
    }
}
document.getElementById('fecha').addEventListener('change', verificarFechaAlerta);

// Notificaciones
elements.btnAllowNotif?.addEventListener('click', pedirPermisoNotificacion);
elements.btnDenyNotif?.addEventListener('click', () => {
    elements.notificationBanner.classList.add('hidden');
});

// Próximo aniversario
document.getElementById('btn-proximo-aniversario').addEventListener('click', () => {
    if (discos.length === 0) {
        alert('No tenés discos cargados todavía.');
        return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let proximo = null;
    let minDias = Infinity;

    discos.forEach(disco => {
        const fecha = parseDate(disco.fecha);
        const mes = fecha.getMonth();
        const dia = fecha.getDate();

        let aniversario = new Date(hoy.getFullYear(), mes, dia);
        if (aniversario < hoy) {
            aniversario = new Date(hoy.getFullYear() + 1, mes, dia);
        }

        const diff = Math.ceil((aniversario - hoy) / (1000 * 60 * 60 * 24));
        if (diff < minDias) {
            minDias = diff;
            proximo = {
                artista: disco.artista,
                album: disco.album,
                fecha: disco.fecha,
                dias: diff,
                tapa: disco.tapa || '',
                anio: aniversario.getFullYear() - fecha.getFullYear(),
                fechaAniversario: aniversario
            };
        }
    });

    if (proximo) {
        proximo.dias = minDias;
        showToast(proximo, minDias <= 1 ? (minDias === 0 ? 'hoy' : 'manana') : 'proximo');
    }
});

// ============================================
// EXPORTAR / IMPORTAR
// ============================================

function descargarArchivo(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function fechaFormateada(fechaStr) {
    if (!fechaStr) return 'Sin fecha';
    const [y, m, d] = fechaStr.split('-');
    return `${d}/${m}/${y}`;
}

// JSON
document.getElementById('btn-export-json').addEventListener('click', () => {
    const dataStr = JSON.stringify(discos, null, 2);
    descargarArchivo(dataStr, `mis-discos-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
});

// XML
document.getElementById('btn-export-xml').addEventListener('click', () => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<coleccion discos="' + discos.length + '">\n';
    discos.forEach(d => {
        xml += '  <disco>\n';
        xml += `    <artista>${escapeXml(d.artista)}</artista>\n`;
        xml += `    <album>${escapeXml(d.album)}</album>\n`;
        xml += `    <fecha>${fechaFormateada(d.fecha)}</fecha>\n`;
        xml += `    <formato>${d.formato}</formato>\n`;
        xml += `    <sello>${escapeXml(d.sello || '')}</sello>\n`;
        xml += `    <genero>${escapeXml(d.genero || '')}</genero>\n`;
        xml += `    <anioEdicion>${d.anioEdicion || ''}</anioEdicion>\n`;
        xml += `    <estado>${d.estado || ''}</estado>\n`;
        xml += `    <estadoTapa>${d.estadoTapa || ''}</estadoTapa>\n`;
        xml += `    <tieneInsert>${d.tieneInsert || 'no'}</tieneInsert>\n`;
        xml += `    <runout>${escapeXml(d.runout || '')}</runout>\n`;
        xml += `    <catalogo>${escapeXml(d.catalogo || '')}</catalogo>\n`;
        xml += `    <barcode>${escapeXml(d.barcode || '')}</barcode>\n`;
        xml += `    <discogsUrl>${escapeXml(d.discogsUrl || '')}</discogsUrl>\n`;
        xml += `    <precioUsd>${d.precioUsd || ''}</precioUsd>\n`;
        xml += `    <cotizacionBlue>${d.cotizacionBlue || ''}</cotizacionBlue>\n`;
        xml += `    <notas>${escapeXml(d.notas || '')}</notas>\n`;
        xml += '  </disco>\n';
    });
    xml += '</coleccion>';
    descargarArchivo(xml, `mis-discos-${new Date().toISOString().split('T')[0]}.xml`, 'application/xml');
});

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// DOC (HTML compatible con Word)
document.getElementById('btn-export-doc').addEventListener('click', () => {
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>Mi Colección de Discos</title>
<style>
body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
table { width: 100%; border-collapse: collapse; margin-top: 20px; }
th { background: #333; color: #fff; padding: 10px; text-align: left; font-size: 0.85rem; }
td { padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 0.85rem; }
tr:nth-child(even) { background: #f5f5f5; }
.formato { text-transform: uppercase; font-size: 0.75rem; font-weight: bold; }
.footer { text-align: center; margin-top: 20px; color: #999; font-size: 0.8rem; }
</style></head><body>
<h1>Mi Colección de Discos</h1>
<p style="text-align:center;color:#666;">${discos.length} discos · Exportado el ${new Date().toLocaleDateString('es-AR')}</p>
<table>
<tr><th>#</th><th>Artista</th><th>Álbum</th><th>Fecha</th><th>Edición</th><th>Formato</th><th>Sello</th><th>Género</th><th>Estado</th><th>Tapa</th><th>Catálogo</th><th>Runout</th><th>Precio USD</th></tr>`;
    discos.forEach((d, i) => {
        html += `<tr><td>${i + 1}</td><td>${d.artista}</td><td>${d.album}</td><td>${fechaFormateada(d.fecha)}</td><td>${d.anioEdicion || '-'}</td><td class="formato">${d.formato}</td><td>${d.sello || '-'}</td><td>${d.genero || '-'}</td><td>${d.estado || '-'}</td><td>${d.estadoTapa || '-'}</td><td>${d.catalogo || '-'}</td><td>${d.runout || '-'}</td><td>${d.precioUsd ? '$' + d.precioUsd + ' USD' : '-'}</td></tr>`;
    });
    html += `</table><div class="footer">Generado por Mis Discos App</div></body></html>`;
    descargarArchivo(html, `mis-discos-${new Date().toISOString().split('T')[0]}.doc`, 'application/msword');
});

// PDF (usa print)
document.getElementById('btn-export-pdf').addEventListener('click', () => {
    const win = window.open('', '_blank');
    let bodyRows = '';
    discos.forEach((d, i) => {
        bodyRows += `<tr><td>${i + 1}</td><td>${d.artista}</td><td>${d.album}</td><td>${fechaFormateada(d.fecha)}</td><td>${d.anioEdicion || '-'}</td><td>${d.formato}</td><td>${d.sello || '-'}</td><td>${d.genero || '-'}</td><td>${d.estado || '-'}</td><td>${d.estadoTapa || '-'}</td><td>${d.catalogo || '-'}</td><td>${d.precioUsd ? '$' + d.precioUsd + ' USD' : '-'}</td></tr>`;
    });
    win.document.write(`<!DOCTYPE html><html><head><title>Mis Discos</title>
<style>
body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
h1 { text-align: center; font-size: 1.5rem; margin-bottom: 5px; }
p.sub { text-align: center; color: #666; font-size: 0.85rem; margin-bottom: 20px; }
table { width: 100%; border-collapse: collapse; }
th { background: #222; color: #fff; padding: 8px; text-align: left; font-size: 0.8rem; }
td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 0.8rem; }
tr:nth-child(even) { background: #f5f5f5; }
@media print { body { padding: 15px; } }
</style></head><body>
<h1>Mi Colección de Discos</h1>
<p class="sub">${discos.length} discos · ${new Date().toLocaleDateString('es-AR')}</p>
<table><tr><th>#</th><th>Artista</th><th>Álbum</th><th>Fecha</th><th>Edición</th><th>Formato</th><th>Sello</th><th>Género</th><th>Estado</th><th>Tapa</th><th>Catálogo</th><th>Precio USD</th></tr>
${bodyRows}</table>
<script>window.onload=function(){window.print();}<\/script></body></html>`);
    win.document.close();
});

// Importar JSON
document.getElementById('btn-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importados = JSON.parse(event.target.result);
            if (!Array.isArray(importados)) {
                alert('Archivo inválido');
                return;
            }
            
            let agregados = 0;
            importados.forEach(d => {
                if (!discoExiste(d.album, d.artista)) {
                    d.id = generarId();
                    discos.push(d);
                    agregados++;
                }
            });
            
            guardarDiscos();
            renderAll();
            alert(`${agregados} discos importados`);
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };
    reader.readAsText(file);
});

// ============================================
// BOTTOM NAVIGATION + TRANSITIONS
// ============================================

const screenOrder = ['screen-agregar', 'screen-aniversarios', 'screen-coleccion'];

let clickAudio = null;

function initAudio() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        clickAudio = ctx;

        const bufferSize = 80;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 12);
        }

        clickAudio._buffer = buffer;
    } catch (e) {
        console.log('Audio no disponible');
    }
}

function playClick() {
    if (!clickAudio || !clickAudio._buffer) return;
    try {
        if (clickAudio.state === 'suspended') clickAudio.resume();

        const source = clickAudio.createBufferSource();
        const gain = clickAudio.createGain();

        source.buffer = clickAudio._buffer;
        gain.gain.value = 0.08;

        source.connect(gain);
        gain.connect(clickAudio.destination);

        source.start(0);
        source.stop(clickAudio.currentTime + 0.06);
    } catch (e) {}
}

let currentScreen = 'screen-agregar';
let isTransitioning = false;

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const screens = document.querySelectorAll('.screen');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetScreen = btn.dataset.screen;
            if (targetScreen === currentScreen || isTransitioning) return;

            playClick();
            navigateTo(targetScreen);
        });
    });
}

function navigateTo(targetScreen) {
    if (isTransitioning) return;
    isTransitioning = true;

    const screens = document.querySelectorAll('.screen');
    const navBtns = document.querySelectorAll('.nav-btn');

    const currentIndex = screenOrder.indexOf(currentScreen);
    const targetIndex = screenOrder.indexOf(targetScreen);
    const goingRight = targetIndex > currentIndex;

    const oldScreen = document.getElementById(currentScreen);
    const newScreen = document.getElementById(targetScreen);

    oldScreen.classList.remove('active');
    oldScreen.classList.add(goingRight ? 'exit-left' : 'exit-right');

    newScreen.style.display = 'block';
    newScreen.style.transition = 'none';
    newScreen.style.opacity = '0';
    newScreen.style.transform = `scale(0.97) translateX(${goingRight ? '30px' : '-30px'})`;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            newScreen.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            newScreen.style.opacity = '1';
            newScreen.style.transform = 'scale(1) translateX(0)';
            newScreen.classList.add('active');
        });
    });

    navBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-screen="${targetScreen}"]`).classList.add('active');

    setTimeout(() => {
        oldScreen.classList.remove('exit-left', 'exit-right');
        oldScreen.style.display = 'none';
        oldScreen.style.transition = '';
        oldScreen.style.opacity = '';
        oldScreen.style.transform = '';
        newScreen.style.transition = '';
        newScreen.style.opacity = '';
        newScreen.style.transform = '';
        currentScreen = targetScreen;
        isTransitioning = false;
    }, 260);
}

function navegarA(screenId) {
    playClick();
    navigateTo(screenId);
}

// ============================================
// SYNC CON GITHUB GIST
// ============================================

function getSyncConfig() {
    return {
        token: localStorage.getItem('sync_token') || '',
        gistId: localStorage.getItem('sync_gist_id') || ''
    };
}

function saveSyncConfig(token, gistId) {
    localStorage.setItem('sync_token', token);
    localStorage.setItem('sync_gist_id', gistId);
}

function updateSyncStatus(msg, type) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'sync-status ' + type;
}

function updateSyncLast() {
    const el = document.getElementById('sync-last');
    const last = localStorage.getItem('sync_last');
    if (el && last) {
        el.textContent = 'Última sync: ' + new Date(last).toLocaleString('es-AR');
    }
}

function mergeDiscos(local, gist) {
    const merged = [...local];
    const localKeys = new Set(local.map(d => `${d.artista}|${d.album}`.toLowerCase()));
    for (const d of gist) {
        const key = `${d.artista}|${d.album}`.toLowerCase();
        if (!localKeys.has(key)) {
            merged.push(d);
        }
    }
    return merged;
}

async function syncFromGist() {
    const { token, gistId } = getSyncConfig();
    if (!token || !gistId) {
        updateSyncStatus('Configurá token y Gist ID', 'error');
        return;
    }

    const icon = document.getElementById('sync-icon');
    if (icon) icon.classList.add('syncing');
    updateSyncStatus('Syncing...', 'ok');

    try {
        // Paso 1: Bajar el Gist actual
        const getResp = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `token ${token}` }
        });

        if (!getResp.ok) throw new Error(`Error bajando: ${getResp.status}`);

        const gist = await getResp.json();
        const fileName = Object.keys(gist.files)[0];
        const content = gist.files[fileName].content;
        const data = JSON.parse(content);
        const gistDiscos = (data.discos && Array.isArray(data.discos)) ? data.discos : [];

        // Paso 2: Mezclar local + gist (no pierde nada)
        const localDiscos = JSON.parse(localStorage.getItem(APP_KEY) || '[]');
        const merged = mergeDiscos(localDiscos, gistDiscos);

        // Paso 3: Subir el resultado mezclado al Gist
        const payload = JSON.stringify({
            discos: merged,
            ultimaSync: new Date().toISOString()
        });

        const putResp = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'discos.json': { content: payload }
                }
            })
        });

        if (!putResp.ok) throw new Error(`Error subiendo: ${putResp.status}`);

        // Paso 4: Guardar localmente
        localStorage.setItem(APP_KEY, JSON.stringify(merged));
        discos = merged;
        renderAll();

        localStorage.setItem('sync_last', new Date().toISOString());
        updateSyncLast();
        updateSyncStatus(`Sync OK (${merged.length} discos)`, 'ok');
    } catch (err) {
        console.error('Sync error:', err);
        updateSyncStatus('Error: ' + err.message, 'error');
    } finally {
        if (icon) icon.classList.remove('syncing');
    }
}

async function syncToGist() {
    const { token, gistId } = getSyncConfig();
    if (!token || !gistId) {
        updateSyncStatus('Configurá token y Gist ID', 'error');
        return;
    }

    const icon = document.getElementById('sync-icon');
    if (icon) icon.classList.add('syncing');

    try {
        const discos = JSON.parse(localStorage.getItem(APP_KEY) || '[]');
        const payload = JSON.stringify({
            discos: discos,
            ultimaSync: new Date().toISOString()
        });

        const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'discos.json': { content: payload }
                }
            })
        });

        if (!resp.ok) throw new Error(`Error ${resp.status}`);
        
        localStorage.setItem('sync_last', new Date().toISOString());
        updateSyncLast();
        updateSyncStatus('Sync OK', 'ok');
    } catch (err) {
        console.error('Sync error:', err);
        updateSyncStatus('Error: ' + err.message, 'error');
    } finally {
        if (icon) icon.classList.remove('syncing');
    }
}

// Event listeners del modal de sync
document.getElementById('btn-sync')?.addEventListener('click', () => {
    document.getElementById('modal-sync').classList.remove('hidden');
    const { token, gistId } = getSyncConfig();
    document.getElementById('sync-token').value = token;
    document.getElementById('sync-gist-id').value = gistId;
    updateSyncLast();
});

document.getElementById('btn-sync-save')?.addEventListener('click', () => {
    const token = document.getElementById('sync-token').value.trim();
    const gistId = document.getElementById('sync-gist-id').value.trim();
    if (!token || !gistId) {
        updateSyncStatus('Completá ambos campos', 'error');
        return;
    }
    saveSyncConfig(token, gistId);
    updateSyncStatus('Configuración guardada', 'ok');
});

document.getElementById('btn-sync-now')?.addEventListener('click', () => {
    console.log('Sync button clicked on mobile');
    syncFromGist();
});

// Cerrar modales con botón ×
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        document.getElementById(modalId)?.classList.add('hidden');
    });
});

// ============================================
// INICIALIZACIÓN
// ============================================

function init() {
    initAudio();
    initNavigation();
    fetchCotizacionBlue();

    // Ocultar todas las pantallas excepto la activa
    document.querySelectorAll('.screen').forEach(s => {
        if (!s.classList.contains('active')) {
            s.style.display = 'none';
        }
    });

    renderAll();
    verificarPermisosNotificacion();
    verificarNotificacionesHoy();
}

if (checkLogin()) {
    init();
}
