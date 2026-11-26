window.LegoModule = (() => {
  // Recherche via l'API officielle Brickset v3 (par numéro de set ex: "75192" ou code-barres EAN)
  async function searchBrickset(query) {
    const apiKey = window.APP_CONFIG?.BRICKSET_API_KEY;
    if (!apiKey) {
      ScannerModule.setStatus('Clé API Brickset manquante dans config.js', 'error');
      return [];
    }

    const clean = String(query || '').trim();
    if (!clean) return [];

    ScannerModule.setStatus(`Recherche Brickset pour "${clean}"...`, 'searching');

    // Si c'est un code-barres long (12-13 chiffres), on cherche par EAN/UPC, sinon par numéro de set
    const isBarcode = /^\d{12,13}$/.test(clean);
    const paramsObj = isBarcode
      ? { extendedData: 1, query: clean }
      : { setNumber: clean.includes('-') ? clean : `${clean}-1` };

    try {
      const formBody = new URLSearchParams({
        apiKey: apiKey,
        userHash: '',
        params: JSON.stringify(paramsObj)
      });

      const res = await fetch('https://brickset.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString()
      });

      const data = await res.json();
      if (data.status !== 'success' || !data.sets || data.sets.length === 0) {
        return [];
      }

      return data.sets.map((s) => ({
        source: 'Brickset',
        titre: s.name || `Set LEGO ${s.number}`,
        serie: s.theme || '',
        numero: s.number || clean.replace('-1', ''),
        auteur_marque: s.subtheme ? `${s.theme} - ${s.subtheme}` : (s.theme || 'LEGO'),
        editeur: 'LEGO',
        annee: s.year ? String(s.year) : '',
        code_barre: s.barcode?.EAN || s.barcode?.UPC || (isBarcode ? clean : ''),
        photo_url: s.image?.imageURL || s.image?.thumbnailURL || '',
        notes: s.pieces ? `${s.pieces} pièces` : ''
      }));
    } catch (e) {
      console.warn('Erreur Brickset:', e);
      return [];
    }
  }

  // Lecture OCR d'un numéro de set (4 à 6 chiffres) sur une photo de boîte LEGO
  async function extractSetNumberFromPhoto(file, onFound) {
    if (typeof Tesseract === 'undefined') {
      ScannerModule.setStatus('OCR non chargé. Saisissez le numéro de set manuellement.', 'error');
      return;
    }
    ScannerModule.setStatus('Lecture du numéro de set sur la photo (OCR)...', 'searching');
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      // On privilégie les nombres à 5 chiffres (standard LEGO actuel), puis 4 ou 6 chiffres
      const fiveDigits = text.match(/\b\d{5}\b/);
      const otherDigits = text.match(/\b\d{4,6}\b/);
      const detected = fiveDigits ? fiveDigits[0] : (otherDigits ? otherDigits[0] : null);

      if (detected) {
        ScannerModule.setStatus(`Numéro de set détecté : ${detected}`, 'success');
        onFound(detected);
      } else {
        ScannerModule.setStatus('Numéro non lisible sur la photo. Saisissez-le ci-dessous.', 'error');
      }
    } catch (e) {
      ScannerModule.setStatus('Impossible de lire la photo. Saisissez le numéro manuellement.', 'error');
    }
  }

  return { searchBrickset, extractSetNumberFromPhoto };
})();
