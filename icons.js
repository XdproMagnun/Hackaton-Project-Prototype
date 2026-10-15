'use strict';
function appIcon(name) {
 const icon = document.createElement('span');
 icon.className = 'app-icon icon-' + name;
 icon.setAttribute('aria-hidden', 'true');
 return icon;
}
