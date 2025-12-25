(function() {
    const socket = new WebSocket('ws://localhost:3000');
    let div = null;

    socket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        if (data.type === 'error') {
            if (!div) {
                div = document.createElement('div');
                div.style = "position:fixed; top:20px; right:20px; background:#bf616a; color:white; padding:20px; border-radius:12px; z-index:999999; font-family:monospace; box-shadow:0 10px 40px rgba(0,0,0,0.4); max-width:450px; border-left:6px solid #880000; font-size:14px;";
                document.body.appendChild(div);
            }
            div.innerHTML = "<div style='font-weight:bold; margin-bottom:10px; font-size:16px;'>🔥 SASS ERROR</div>" + data.message;
            div.style.display = 'block';
        } else {
            if (div) div.style.display = 'none';
        }
    };
})();