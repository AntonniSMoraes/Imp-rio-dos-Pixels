// Anime source illustrations are recolored locally from persisted hereditary traits.
// A portrait is cropped from the same composed figure used by the character sheet.
const artCache = new Map(),
  animeTiles = new Map();
let animeAtlas = null,
  raceAtlases = new Map(),
  rankAtlas = null,
  animeLoadError = false,
  canvasReadBlocked = false;
const EMPTY_ART_URL = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
const ANIME_ROWS = [
  [0, 420],
  [420, 865],
  [865, 1195],
  [1195, 1536],
];
