var pixelate = {};
window.pixelate = pixelate;

pixelate.defaultConf = {
	sizeX: 4;
	sizeY: 4;
	intervalX: 5;
	intervalY: 5;
};

function initPixeate(context, conf) {
	var width = context.width;
	var height = context.height;
	conf = conf || pixelate.defaultConf;
}