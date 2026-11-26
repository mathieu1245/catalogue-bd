window.BDModule = (() => {
  function cleanIsbn(raw) {
    return String(raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  }

  // 1. Recherche sur la Bibliothèque nationale de France (BnF SRU)
  async function searchBnF(query, isIsbn = false) {
    try {
      const cql = isIsbn
        ? `bib.isbn all "${query}"`
        : `bib.title all "${query}" and bib.doctype all "a"`;
      const url = `https://bnf.fr{encodeURIComponent(cql)}&recordSchema=dublincore&maximumRecords=6`;
      const res = await fetch(url);
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const records = Array.from(xml.getElementsByTagNameNS('*', 'dc'));

      return records.map((dc) => {
        const getTag = (name) => dc.getElementsByTagNameNS('*', name)[0]?.textContent?.trim() || '';
        const rawTitle = getTag('title');
        const parts = rawTitle.split('/').map((s) => s.trim());
        const titre = parts[0] || 'Sans titre';
        const tomeMatch = titre.match(/(?:tome|t\.|vol\.|#)\s*(\d+)/i);

        return {
          source: 'BnF',
          titre: titre,
          serie: '',
          numero: tomeMatch ? tomeMatch[1] : '',
          auteur_marque: getTag('creator').replace(/\.$/, ''),
          editeur: getTag('publisher'),
          annee: (getTag('date').match(/\d{4}/) || [''])[0],
          code_barre: isIsbn ? query : '',
          photo_url: isIsbn ? `https://openlibrary.org{query}-L.jpg?default=false` : ''
        };
      });
    } catch (e) {
      console.warn('Erreur BnF:', e);
      return [];
    }
  }

  // 2. Recherche sur Google Books API (avec votre clé config.js)
  async function searchGoogleBooks(query, isIsbn = false) {
    try {
      const apiKey = window.APP_CONFIG?.GOOGLE_BOOKS_API_KEY;
      const q = isIsbn ? `isbn:${query}` : query;
      let url = `https://googleapis.com{encodeURIComponent(q)}&maxResults=8&langRestrict=fr`;
      if (apiKey) url += `&key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!data.items) return [];

      return data.items.map((item) => {
        const info = item.volumeInfo || {};
        const identifiers = info.industryIdentifiers || [];
        const isbn13 = identifiers.find((i) => i.type === 'ISBN_13')?.identifier || (isIsbn ? query : '');
        const img = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
        const tomeMatch = (info.title || '').match(/(?:tome|t\.|vol\.|#)\s*(\d+)/i);

        return {
          source: 'Google Books',
          titre: info.title || 'Sans titre',
          serie: info.subtitle || '',
          numero: tomeMatch ? tomeMatch[1] : '',
          auteur_marque: (info.authors || []).join(', '),
          editeur: info.publisher || '',
          annee: (info.publishedDate || '').slice(0, 4),
          code_barre: isbn13,
          photo_url: img.replace('http://', 'https://')
        };
      });
    } catch (e) {
      console.warn('Erreur Google Books:', e);
      return [];
    }
  }

  async function lookupByIsbn(rawCode) {
    const isbn = cleanIsbn(rawCode);
    if (!isbn) return [];
    ScannerModule.setStatus(`Recherche de l'ISBN ${isbn} (BnF + Google Books)...`, 'searching');
    const [bnfResults, googleResults] = await Promise.all([
      searchBnF(isbn, true),
      searchGoogleBooks(isbn, true)
    ]);
    return [...bnfResults, ...googleResults];
  }

  async function lookupByTitle(title) {
    if (!title.trim()) return [];
    ScannerModule.setStatus(`Recherche "${title}"...`, 'searching');
    const [googleResults, bnfResults] = await Promise.all([
      searchGoogleBooks(title, false),
      searchBnF(title, false)
    ]);
    return [...googleResults, ...bnfResults];
  }

  return { lookupByIsbn, lookupByTitle, cleanIsbn };
})();
