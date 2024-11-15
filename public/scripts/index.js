(() => {
    // Watch position elements
    const textLatitude = document.querySelector(".latitude");
    const textLongtitude = document.querySelector(".longtitude");
    // Posisi sekarang
    let latitude = 0;
    let longtitude = 0;

    if (navigator.geolocation) {
        // Watch posisi
        navigator.geolocation.watchPosition(locationOnSuccess, locationOnError, {
            enableHighAccuracy: true
        });
    } else {
        locationOnError();
    }

    // Current position
    function locationOnError() {
        const modalGagal = new bootstrap.Modal("#modalIzinLokasiGagal", {
            backdrop: "static",
            keyboard: false
        });

        modalGagal.show();
    }

    /**
     * @param {GeolocationPosition} pos
     */
    function locationOnSuccess(pos) {
        latitude = pos.coords.latitude;
        longtitude = pos.coords.longitude; 

        // Ubah nomor X dan Y
        textLatitude.innerHTML = latitude;
        textLongtitude.innerHTML = longtitude;
    }

    
    // Tombol emergency //
    /**
     * @type {HTMLDivElement}
     */
    const bigButton = document.querySelector(".big-button");

    // Touch perlu dihandle di js untuk transisi
    // karena mobile tidak support :active
    bigButton.ontouchstart = bigButton.onmousedown = () => {
        bigButton.classList.add("pressed");

        // TODO
        window.location.href = `https://www.google.com/maps?q=loc:${latitude},${longtitude}`;
        
        // Mencegah context menu muncul di mobile
        window.oncontextmenu = function(event) {
            event.preventDefault();
            event.stopPropagation();
            return false;
       };
    }

    bigButton.ontouchend = bigButton.onmouseup = () => {
        bigButton.classList.remove("pressed");
        window.oncontextmenu = null;
    }
})();