window.WebScraperModule = (() => {
  function isDirectImageUrl(url) {
    return /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(url);
  }

  async function extractFromUrl(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      ScannerModule.setStatus('Veuillez saisir un lien valide commençant par http:// ou https://', 'error');
      return null;
    }
    if (isDirectImageUrl(url)) {
      ScannerModule.setStatus('Lien image direct appliqué !', 'success');
      return { photo_url: url };
    }
    ScannerModule.setStatus('Extraction des informations et de la photo depuis la page web...', 'searching');
    try {
      const proxyUrl = `https://allorigins.win{encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const data = await res.json();
      if (!data || !data.contents) throw new Error('Contenu vide');

      const doc = new DOMParser().parseFromString(data.contents, 'text/html');
      const getMeta = (sel) => doc.querySelector(sel)?.getAttribute('content')?.trim() || '';
      const titre = getMeta('meta[property="og:title"]') || doc.querySelector('h1')?.textContent?.trim() || doc.title || '';
      const description = getMeta('meta[property="og:description"]') || getMeta('meta[name="description"]') || '';
      let image = getMeta('meta[property="og:image"]') || getMeta('meta[name="twitter:image"]') || '';
      if (image && !/^https?:\/\//i.test(image)) image = new URL(image, url).href;

      const pageText = doc.body?.textContent || '';
      const refMatch = pageText.match(/(?:réf(?:érence)?|ref|art(?:icle)?)\s*[:.#-]?\s*([A-Z0-9-]{3,15})/i);

      if (!image && !titre && !description) {
        ScannerModule.setStatus('Page protégée : collez le lien direct de l’image ou prenez une photo.', 'error');
        return null;
      }
      ScannerModule.setStatus('Informations et photo récupérées depuis le lien !', 'success');
      return { titre, code_barre: refMatch ? refMatch.at(1) : '', photo_url: image, notes: description };
    } catch (e) {
      ScannerModule.setStatus('Site protégé contre la lecture auto. Collez l’URL directe de l’image ou prenez une photo.', 'error');
      return null;
    }
  }

  return { extractFromUrl };
})();
