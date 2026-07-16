/* ================================================================
   teams — MLB franchise table: statsapi team id ↔ canonical abbrev
   (Date-Decoder convention: ARI/OAK/CWS/WSH/KC/SD/SF/TB) ↔ identity
   history. statsapi ids are franchise-stable across relocations
   (live-verified 2026-07-16 on historic schedules: Expos→120,
   Brooklyn Dodgers→119, St. Louis Browns→110, NY Giants→137,
   Philadelphia A's→133, 1901 Senators→142, 1901 Brewers→110), so
   lineage is the identity map. Shared by the app (h2hFor lineage
   stamps) and scripts/build-mlb-h2h.mjs (crawl reduction).
   Exception: the 1901-02 AL Baltimore Orioles are id 298 — a defunct
   franchise in statsapi (NYY id 147 starts 1903), NOT part of any
   current lineage.
================================================================ */
export const MLB_TEAMS={
  108:{abbrev:'LAA',identities:['Los Angeles/California/Anaheim Angels','Los Angeles Angels']},
  109:{abbrev:'ARI',identities:['Arizona Diamondbacks']},
  110:{abbrev:'BAL',identities:['Milwaukee Brewers (1901)','St. Louis Browns','Baltimore Orioles']},
  111:{abbrev:'BOS',identities:['Boston Americans','Boston Red Sox']},
  112:{abbrev:'CHC',identities:['Chicago Orphans','Chicago Cubs']},
  113:{abbrev:'CIN',identities:['Cincinnati Reds']},
  114:{abbrev:'CLE',identities:['Cleveland Blues/Naps/Indians','Cleveland Guardians']},
  115:{abbrev:'COL',identities:['Colorado Rockies']},
  116:{abbrev:'DET',identities:['Detroit Tigers']},
  117:{abbrev:'HOU',identities:['Houston Colt .45s','Houston Astros']},
  118:{abbrev:'KC',identities:['Kansas City Royals']},
  119:{abbrev:'LAD',identities:['Brooklyn Superbas/Robins/Dodgers','Los Angeles Dodgers']},
  120:{abbrev:'WSH',identities:['Montreal Expos','Washington Nationals']},
  121:{abbrev:'NYM',identities:['New York Mets']},
  133:{abbrev:'OAK',identities:['Philadelphia Athletics','Kansas City Athletics','Oakland Athletics','Athletics']},
  134:{abbrev:'PIT',identities:['Pittsburgh Pirates']},
  135:{abbrev:'SD',identities:['San Diego Padres']},
  136:{abbrev:'SEA',identities:['Seattle Mariners']},
  137:{abbrev:'SF',identities:['New York Giants','San Francisco Giants']},
  138:{abbrev:'STL',identities:['St. Louis Cardinals']},
  139:{abbrev:'TB',identities:['Tampa Bay Devil Rays','Tampa Bay Rays']},
  140:{abbrev:'TEX',identities:['Washington Senators (1961)','Texas Rangers']},
  141:{abbrev:'TOR',identities:['Toronto Blue Jays']},
  142:{abbrev:'MIN',identities:['Washington Senators (1901)','Minnesota Twins']},
  143:{abbrev:'PHI',identities:['Philadelphia Quakers','Philadelphia Phillies']},
  144:{abbrev:'ATL',identities:['Boston Beaneaters/Braves','Milwaukee Braves','Atlanta Braves']},
  145:{abbrev:'CWS',identities:['Chicago White Sox']},
  146:{abbrev:'MIA',identities:['Florida Marlins','Miami Marlins']},
  147:{abbrev:'NYY',identities:['New York Highlanders','New York Yankees']},
  158:{abbrev:'MIL',identities:['Seattle Pilots','Milwaukee Brewers']},
};

export const lineageFor=teamId=>MLB_TEAMS[teamId]?.abbrev||null;
