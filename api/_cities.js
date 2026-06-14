const CITIES = new Set([
    'Acarigua','Altagracia de Orituco','Anaco','Araure','Arismendi','Aroa',
    'Bachaquero','Barinas','Barinitas','Barcelona','Barlovento','Barquisimeto',
    'Barrancas del Orinoco','Biruaca','Biscucuy','Boconó','Bobures',
    'Cabudare','Caicara del Orinoco','Cagua','Calabozo','Camatagua','Cantaura',
    'Capacho','Caraballeda','Caracas','Cariaco','Caripito','Carora','Carrizal',
    'Carúpano','Catia La Mar','Caucagua','Charallave','Chaguaramas','Chichiriviche',
    'Chivacoa','Churuguara','Ciudad Bolívar','Ciudad Bolivia','Ciudad Guayana',
    'Ciudad Ojeda','Clarines','Cocorote','Colón','Colonia Tovar','Coro',
    'Cumaná','Cumanacoa','Curiapo','Cúa',
    'Dabajuro',
    'Ejido','El Amparo','El Baúl','El Callao','El Chaparro','El Furrial',
    'El Limón','El Moján','El Pao','El Sombrero','El Tigre','El Tigrito',
    'El Tocuyo','El Valle del Espíritu Santo','El Vigía','Elorza','Encontrados',
    'Escuque',
    'Guacara','Guanare','Guanarito','Guarenas','Guasipati','Guasdualito',
    'Guatire','Güiria','Guanta',
    'Higuerote',
    'Irapa',
    'Juan Griego',
    'La Asunción','La Azulita','La Cañada de Urdaneta','La Fría','La Grita',
    'La Guaira','La Vela de Coro','La Victoria','Lagunillas','Las Tejerías',
    'Lecherías','Libertad de Barinas','Los Guayos','Los Taques','Los Teques',
    'Machiques','Maiquetía','Mantecal','Maracaibo','Maracay','Mariara',
    'Maturín','Mene Grande','Mérida','Montalbán','Morón','Motatán','Mucuchíes',
    'Naguanagua','Naiguatá','Nirgua',
    'Obispos','Ocumare de la Costa','Ocumare del Tuy','Onoto','Ospino',
    'Palo Negro','Pampán','Pampatar','Papelón','Pariaguán','Pedernales',
    'Pedregal','Píritu','Porlamar','Puerto Ayacucho','Puerto Cabello',
    'Puerto La Cruz','Puerto Nutrias','Puerto Ordaz','Puerto Páez','Punta de Mata',
    'Punto Fijo',
    'Quíbor',
    'Río Caribe','Río Chico','Rubio',
    'Sabaneta','San Antonio de los Altos','San Antonio del Táchira','San Carlos',
    'San Carlos de Río Negro','San Casimiro','San Cristóbal','San Diego',
    'San Felipe','San Fernando de Apure','San Fernando de Atabapo','San Félix',
    'San Joaquín','San José de Guaribe','San Juan Bautista','San Juan de los Morros',
    'San Juan de Payara','San Sebastián de los Reyes','San Tomé','Sanare',
    'Santa Ana del Táchira','Santa Bárbara del Zulia','Santa Cruz de Mora',
    'Santa Rita','Santa Teresa del Tuy','Sinamaica','Siquisique','Socopó',
    'Soledad',
    'Tabay','Táriba','Temblador','Tinaco','Tinaquillo','Tocuyito','Tovar',
    'Trujillo','Tucacas','Tucupido','Tucupita','Tumeremo','Turmero','Turén',
    'Upata','Urachiche','Ureña',
    'Valera','Valencia','Valle de la Pascua','Villa de Cura','Villa Rosa',
    'Yaguaraparo','Yaritagua',
    'Zaraza','Zuata',
]);

const ZONES = new Set(['', 'Norte', 'Centro', 'Sur', 'Este', 'Oeste']);

function isValidCity(city) {
    if (!city || city === '') return true;
    return CITIES.has(city);
}

function isValidZone(zone) {
    return ZONES.has(zone || '');
}

module.exports = { isValidCity, isValidZone };
