window.ScannerModule = (() => {
  let html5QrCode = null;
  let isRunning = false;

  function setStatus(msg, type = 'searching') {
    const el = document.getElementById('scan-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'scan-status ' + type;
  }

  async function stopCamera() {
    const container = document.getElementById('reader-container');
    const btnStop = document.getElementById('btn-stop-scan');
    if (html5QrCode && isRunning) {
      try {
        await html5QrCode.stop();
        html5QrCode.clear();
      } catch (e) {}
    }
    isRunning = false;
    if (container) container.classList.remove('active');
    if (btnStop) btnStop.style.display = 'none';
  }

  async function startCamera(onDetected) {
    await stopCamera();
    const container = document.getElementById('reader-container');
    const btnStop = document.getElementById('btn-stop-scan');
    container.classList.add('active');
    btnStop.style.display = 'inline-block';
    setStatus('Démarrage de la caméra...', 'searching');

    const config = { fps: 10, qrbox: { width: 250, height: 120 } };
    const onSuccess = async (decodedText) => {
      await stopCamera();
      setStatus('Code détecté : ' + decodedText, 'success');
      onDetected(decodedText);
    };

    try {
      html5QrCode = new Html5Qrcode('reader-container', {
        useBarCodeDetectorIfSupported: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128
        ]
      });

      try {
        // 1. Caméra arrière (téléphone / tablette)
        await html5QrCode.start({ facingMode: 'environment' }, config, onSuccess, () => {});
      } catch (e1) {
        // 2. Repli automatique sur webcam intégrée (MacBook / PC)
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) throw new Error('Aucune caméra détectée');
        await html5QrCode.start(cameras.at(0).id, config, onSuccess, () => {});
      }

      isRunning = true;
      setStatus('Placez le code-barres devant la caméra...', 'searching');
    } catch (err) {
      await stopCamera();
      setStatus('Caméra bloquée ou absente (' + (err.message || err) + '). Autorisez la caméra dans Safari ou utilisez Photo.', 'error');
    }
  }

  async function scanFromFile(file, onDetected, onFallbackOcr) {
    if (!file) return;
    await stopCamera();
    setStatus('Analyse de la photo en cours...', 'searching');

    try {
      const fileScanner = new Html5Qrcode('reader-hidden', { useBarCodeDetectorIfSupported: false });
      const decodedText = await fileScanner.scanFile(file, false);
      fileScanner.clear();
      setStatus('Code-barres lu sur la photo : ' + decodedText, 'success');
      onDetected(decodedText);
    } catch (err) {
      if (typeof onFallbackOcr === 'function') {
        onFallbackOcr(file);
      } else {
        setStatus('Aucun code-barres détecté sur cette photo.', 'error');
      }
    }
  }

  return { startCamera, stopCamera, scanFromFile, setStatus };
})();
