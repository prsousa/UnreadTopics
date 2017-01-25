"use strict"

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-90758466-1']);

var Analytics = Analytics || {
    addEvent: function(category, eventStr) {
        _gaq.push(['_trackEvent', category, eventStr]);
    },
    trackPageView: function() {
        _gaq.push(['_trackPageview']);
    }
};

(function () {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
