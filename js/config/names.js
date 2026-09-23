// Broad northern / medieval name banks. Existing citizens retain their identities.
const NAME_BANK = {
  female:
    `Elara Sigrid Astrid Freya Ingrid Runa Alva Eira Liv Ylva Kara Adela Adelheid Aelith Aenora Aeryn Agatha Agnes Aila Ailsa Alarice Alda Aleidis Alfhild Alfrida Alina Alis Alodia Althea Amalia Ameline Anika Annora Ardis Arlena Asa Asta Audhild Aveline Beatrice Berengaria Berit Berta Birgit Bodil Branna Brenna Brynja Calla Catrin Cecily Celia Cerys Clara Clarice Cordelia Dagmar Dagný Danika Daria Delia Disa Dorothea Edda Edith Edwina Eirlys Eleanor Elfrida Elin Elisabet Ellinor Elowen Elsa Elsbeth Embla Emer Enid Erika Erna Estrid Evelina Fenna Fiora Frida Gerd Gisela Grete Grimhild Gudrun Gwendolyn Gyda Halla Halldis Hanna Hedda Hedvig Helga Heloise Herdis Hilda Hildegard Hillevi Idunn Ilse Imogen Inga Ingeborg Irma Isabeau Isolde Ivara Johanna Jorunn Juna Katla Kerstin Linnea Lisbeth Livia Lotta Lucinda Lyra Maerwynn Magdalena Malena Margit Mariel Marit Matilda Melisande Meriel Mette Milena Minna Mira Moira Morwen Nadia Nanna Nerissa Niamh Nora Oda Odette Olga Oriana Otilia Petra Ragnhild Rannveig Rebekka Renata Rhiannon Rikka Rosalind Rosamund Rowena Sabina Saga Sanna Selene Serena Signe Sigrun Sissel Solveig Sonja Sunniva Svea Sylva Talia Tamsin Thora Thyra Torhild Tove Tuva Tyra Ulrika Una Valdis Valeria Vedis Vera Vigdis Vilma Viveka Winifred Ysolda Yrsa Yvette Zaria`.split(
      " ",
    ),
  male: `Aldric Bjorn Ivar Erik Leif Torin Hakon Sten Edric Ulric Arvid Abel Adalbert Ademar Aedan Aelfric Aelred Aethelstan Alaric Albert Albin Alden Alf Alistair Alrik Alwin Anders Anselm Arne Arnulf Asger Aslak Asmund Atle Audun Axel Baldric Balduin Bard Bastian Benedict Berengar Bertram Birger Bo Bork Bragi Bran Brand Bram Brenin Bryn Cadric Caelan Calder Cedric Cerdic Conrad Corin Cormac Dag Dagfinn Dain Dalen Darius Dieter Dorian Drystan Duncan Eadgar Eamon Eberhard Ebbe Einar Eldred Elias Elric Emil Emmerich Endre Engar Eogan Erland Esben Eskil Evander Falk Faramond Fendrel Fergus Finn Folke Fritjof Frode Galen Gareth Garrick Geir Gerhard Gilbert Gisli Godfrey Godric Goran Gregor Grim Gunnar Gustav Guthrum Halden Halfdan Hallvard Halvar Harald Hartwin Havel Henrik Herleif Hilmar Hjalmar Holger Hugh Ingmar Ingo Isak Iver Jakob Jareth Jesper Johan Joran Jost Kellan Kieran Knut Kol Kormak Larkin Lars Laurits Lennart Leon Leofric Leopold Lorcan Lucan Ludvig Magnus Malric Marius Mathis Mikkel Morgan Niall Niklas Nils Odd Olaf Oren Orin Orvar Osric Osvald Othmar Otto Per Rafe Ragnar Rainer Ralf Rasmus Reidar Roderic Roland Rolf Ronan Rowan Rurik Sevrin Sigmund Sigurd Soren Staffan Stig Sune Sven Sverre Tage Tarald Thelric Theobald Thorald Thorben Thorsten Tiber Toke Tomas Torald Tord Torgny Torvald Tristan Trygve Ulf Uriel Valdemar Vidar Viggo Vilhelm Waldemar Walter Wendel Wilfred Wolfram Yorick Yngvar Yvain Zacharias`.split(
    " ",
  ),
  family:
    `Vinter Holt Skald Frost Lund Berg Aasen Dahl Valen Grimwald Ashford Ashborne Ashdown Ashgrove Ashenfell Ashwick Alderbrook Aldermere Alderstone Almswood Amberfall Amberwick Arkenfell Arkwright Atterholt Avenhall Avenmoor Avenridge Blackbriar Blackfen Blackford Blackmere Blackthorn Blackwood Birchfall Birchgrove Birkenholt Bjornholt Brackenfell Brackenford Bramblewick Brandhelm Brandvik Briarcrest Briarhall Briarwick Brightwater Broadfell Brookhaven Brookmere Brynwood Caerwyn Caldenhall Cedarvale Cinderbrook Cinderfell Clearbrook Coldhaven Coldridge Coldwater Crowford Crowhurst Crowmere Crownholt Dalgaard Darkfell Dawnbrook Dawnfell Deepford Denholm Driftwood Dunford Dunhaven Dunmere Duskfell Eaglecrest Ebonholt Eldenbrook Eldenfell Eldenwood Elmsford Elmswick Emberhall Emberholt Everfrost Fairbrook Faircrest Fairford Fairhaven Farrowfell Fennbrook Fenwick Fernhall Firholm Fjellborn Flintbrook Flintcrest Flintford Flinthelm Foxglove Foxhall Foxmere Frostborne Frostgard Frosthall Frosthelm Frostmere Frostwick Gildedale Glenbrook Glencairn Glenmere Goldcrest Goldmere Granholm Grayhaven Graymere Graystone Greenbriar Greenfell Greenford Grimholt Grimstone Grimvik Grovewood Haldorsen Hammerfell Harrowdale Harrowfen Hartbrook Hartfell Hartwood Hawkridge Hawkwood Hazelmere Hearthford Hedgemoor Highcrest Highfell Highmere Hjorvik Holloway Holmgaard Honeybrook Hrafnholt Icebrook Iceford Iceholm Ironbark Ironbrook Ironfell Ironhall Ironhart Ironholt Ironmere Ironwood Isenfeld Isenheim Kaldvik Keelholm Kestrelford Kjorstad Langholm Larkspur Lindberg Lindenbrook Lindholm Lindwood Lioncrest Longford Longmere Lowenfell Mardenfell Marshbrook Mereford Mistbrook Mistfell Mistholm Mistvale Moonbrook Mooncrest Moonford Moorcroft Morcant Mournfell Netherford Nightbrook Nightholt Nordahl Nordgard Nordheim Nordholt Nordlund Norvik Oakcrest Oakenfell Oakenford Oakhall Oakmere Oakward Oathborn Oathkeeper Olsgaard Ormholt Ormvik Owlbrook Pinecrest Pineford Pinehall Pineholt Ravensbrook Ravensfell Ravensford Ravensgard Ravensholm Ravensmere Ravenswood Redbrook Redcrest Redfern Redford Redholm Redmere Reedbrook Reedford Ridgewood Rimeborn Rimefell Rimegard Riverford Riverholt Rockford Rockmere Rosebrook Rosefell Rosethorn Rowanbrook Rowanford Runeberg Runefell Runegard Runeholt Rustholm Saltvik Sandford Seabrook Seaford Seagard Seawick Shadowfen Shieldborn Shieldford Silverbark Silverbrook Silvercrest Silverfell Silverford Silverhall Silvermere Skagen Skogholm Skyfall Snowborne Snowbrook Snowcrest Snowfell Snowford Snowhall Solberg Solheim Solvik Sparrowsong Stagcrest Stagford Starbrook Starfell Starford Stenfeld Stenholm Stonebriar Stonebrook Stonecrest Stonefall Stoneford Stonegard Stonehall Stonehelm Stoneholt Stonemere Stormborn Stormbrook Stormcrest Stormfell Stormford Stormgard Stormhall Stormhaven Stormholm Stormmere Strandvik Sundgaard Sundholm Swanbrook Swanford Tallcrest Tallwood Thistledown Thornbrook Thorncrest Thornfell Thornfield Thornford Thornhall Thornwick Tidemere Torberg Torholm Torsvik Trevelyan Ulfgaard Ulfsen Valecrest Valestrand Vargfell Vargheim Varnholt Vedholm Vestrand Vintergard Vinterholm Vintermere Waldheim Waldenbrook Wardenfell Westbrook Westford Westmere Whitbriar Whitebrook Whitecrest Whitefell Whiteford Whitehart Whitehill Whiteholt Whitemere Whitestone Whitewood Wildbrook Wildfell Willowbrook Willowford Windbrook Windcrest Windfell Windford Windhall Windmere Winterborne Wintercrest Winterfell Winterford Winterhall Wintermere Wolfbrook Wolfcrest Wolffell Wolfford Wolfgard Wolfhart Wolfhelm Wolfholt Wolfmere Woodcroft Woodford Wrenford Wyrmholt Yewbrook Yewford Yggard Ylving`.split(
      " ",
    ),
};

const nameRegistry = { names: new Set(), families: new Set(), full: new Set() };

const nameKey = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function rememberIdentity(p) {
  if (!p) return;
  if (p.name) nameRegistry.names.add(nameKey(p.name));
  if (p.family) nameRegistry.families.add(nameKey(p.family));
  if (p.name && p.family) nameRegistry.full.add(nameKey(p.name + " " + p.family));
}

function seedNames(people) {
  nameRegistry.names.clear();
  nameRegistry.families.clear();
  nameRegistry.full.clear();
  if (Array.isArray(people)) {
    people.forEach(rememberIdentity);
  }
}

function chooseUnused(pool, used) {
  const free = pool.filter((n) => !used.has(nameKey(n)));
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

function freshFamily() {
  let family = chooseUnused(NAME_BANK.family, nameRegistry.families);
  if (!family) {
    const first = [
      "Alder", "Ash", "Birch", "Black", "Bright", "Crow", "Dawn", "Elder",
      "Ember", "Frost", "Gold", "Gray", "Hawk", "Iron", "Mist", "Moon",
      "Oak", "Pine", "Raven", "Red", "Rune", "Silver", "Snow", "Star",
      "Stone", "Storm", "Thorn", "White", "Wind", "Wolf",
    ];
    const last = [
      "borne", "brook", "crest", "dale", "fell", "field", "ford", "gard",
      "grove", "hall", "haven", "helm", "hold", "holt", "mere", "moor",
      "ridge", "stone", "vale", "ward", "wick", "wood",
    ];
    const combos = first.flatMap((a) => last.map((b) => a + b));
    family =
      chooseUnused(combos, nameRegistry.families) ||
      NAME_BANK.family[Math.floor(Math.random() * NAME_BANK.family.length)];
  }
  nameRegistry.families.add(nameKey(family));
  return family;
}

function getRandomPresetName(sex = "M") {
  const pool = sex === "F" ? NAME_BANK.female : NAME_BANK.male;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomPresetFamily() {
  return NAME_BANK.family[Math.floor(Math.random() * NAME_BANK.family.length)];
}

function allocateIdentity(name, sex, family) {
  // Trata e limpa strings caso venham do formulário do jogador
  name = typeof name === "string" ? name.trim() : "";
  family = typeof family === "string" ? family.trim() : "";

  family = family || freshFamily();

  if (!name) {
    const pool = sex === "F" ? NAME_BANK.female : NAME_BANK.male;
    name = chooseUnused(pool, nameRegistry.names);
    if (!name) {
      const start = Math.floor(Math.random() * pool.length);
      outer: for (let a = 0; a < pool.length; a++) {
        for (let b = 0; b < pool.length; b++) {
          if (a === b) continue;
          const candidate =
            pool[(a + start) % pool.length] +
            " " +
            pool[(b + start) % pool.length];
          if (!nameRegistry.names.has(nameKey(candidate))) {
            name = candidate;
            break outer;
          }
        }
      }
    }
    if (!name) name = pool[Math.floor(Math.random() * pool.length)];
  }

  const identity = { name, family };
  rememberIdentity(identity);
  return identity;
}