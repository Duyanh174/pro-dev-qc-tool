(function() {
    const socket = new WebSocket('ws://127.0.0.1/:3000');
    let errorOverlay = null;

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'error') {
            if (!errorOverlay) {
                errorOverlay = document.createElement('div');
                errorOverlay.style = `
                    position: fixed; top: 20px; right: 20px; 
                    background: #bf616a; color: white; padding: 20px; 
                    border-radius: 12px; z-index: 9999999999; 
                    font-family: 'Fira Code', monospace; font-size: 14px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5); 
                    max-width: 450px; border-left: 6px solid #880000;
                `;
                document.body.appendChild(errorOverlay);
            }
            errorOverlay.innerHTML = `<div style="font-weight:bold; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:5px;">🔥 SASS ERROR DETECTED</div>` + data.message;
            errorOverlay.style.display = 'block';
        } else {
            if (errorOverlay) errorOverlay.style.display = 'none';
        }
    };

    socket.onclose = () => console.log("Disconnected from Pro Dev Suite.");
})();