// setting up three.js to render stl object

var scene = new THREE.Scene();

var materialSTL = new THREE.MeshLambertMaterial({color:0x595959})
var materialPiso = new THREE.MeshPhongMaterial({color:0x3799E8})

var camera = new THREE.PerspectiveCamera(75, (window.innerWidth - 200) / window.innerHeight, 0.1, 5000);
//camera.position.x=-50;
//camera.position.y=-50;



var renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setClearColor("#e5e5e5");
renderer.setSize(window.innerWidth - 200, window.innerHeight);
renderer.shadowMapEnabled =true;
renderer.shadowMapType = THREE.BasicShadowMap;
document.body.appendChild( renderer.domElement );


cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
cameraControls.target.set(0, 31, 0);
cameraControls.update();

var groundGeom = new THREE.PlaneGeometry(220, 220, 22, 22);
var groundMesh = new THREE.Mesh(groundGeom, materialPiso);
groundMesh.position.x = 0;
groundMesh.position.y = 0;
groundMesh.position.z = 0;
groundMesh.receiveShadow = true;
scene.add(groundMesh);


//maybe use lighting later -> need to use lambert or phong materials instead of basic
//var ambientLight = new THREE.AmbientLight(0x330000,1000);
var ambientLight = new THREE.AmbientLight(0x330000,0.2); 
scene.add(ambientLight);

//var pointLight = new THREE.PointLight(0xffffff);
var pointLight = new THREE.PointLight(0xDBDBDB,0.8,18);
pointLight.position.set( 0, 0, 250 );


scene.add( pointLight );

var directionalLight = new THREE.DirectionalLight(0xffffff);
directionalLight.position.set(1, 1, 50).normalize();
directionalLight.castShadow = true;
directionalLight.shadowCameraNear = 0.1;
directionalLight.shadowCameraFar = 25;
scene.add(directionalLight);

camera.position.z=220;
camera.lookAt(new THREE.Vector3(0,1.8,0));
// three.js rendering loop

function render() {
	renderer.render(scene, camera);
	requestAnimationFrame(render);
	cameraControls.update();
}

render();


// this function handles the file stl file input using filereader
function handleStlFile(files) {
	file = files[0]

	window.stl_reader = {};

	if (file) {
		// check if file is stl file
		var fileName = file.name;
		if (fileName.substring(fileName.length - 4,fileName.length) === ".stl") {
			// read as text -> if file starts with solid, it is ascii format otherwise it is binary
			var reader = new FileReader();

			reader.readAsText(file, "UTF-8");

			reader.onload = function (evt) {
				// remove previous solid if any
				removePrevious();


				// initialize three.js geometry to put all faces in
				window.stl_reader.geometry = new THREE.Geometry();

				// lines is an object that is used like a hash to save which line connects which two faces.
				// lines[vertex 1, vertex 2] = [face 1, face 2]
				window.stl_reader.lines = {};

				// vertices is an object that is used like a hash, saving normals of faces including the vertex.
				// Up to two normals is saved since if there is more than one normal, it is a regular vertex.
				// vertices[vertex index] = [normal, normal]
				window.stl_reader.vertices = {};

				window.stl_reader.addFaceToLine = function(lines, line, currFace) {
					if (lines[line]) {
						lines[line].push(currFace);
					} else {
						lines[line] = [currFace];
					}
				};

				// function that populates the lines object
				window.stl_reader.lineHandle = function(lines, currFace, vertIndex) {
					var line = [vertIndex[0],vertIndex[1]].sort();
					window.stl_reader.addFaceToLine(lines, line, currFace);

					var line = [vertIndex[1],vertIndex[2]].sort();
					window.stl_reader.addFaceToLine(lines, line, currFace);

					var line = [vertIndex[0],vertIndex[2]].sort();
					window.stl_reader.addFaceToLine(lines, line, currFace);
				};

				// function that populates the vertices object
				window.stl_reader.addNormalToVertices = function (vertexIndex, currFaceNormal) {
					var vertices = window.stl_reader.vertices;

					if (vertices[vertexIndex]) {
						if (vertices[vertexIndex].length < 2) {
							if (!isSameVectorOrVertex(vertices[vertexIndex][0], currFaceNormal)) {
								vertices[vertexIndex].push(currFaceNormal);
							}
						}
					} else {
						vertices[vertexIndex] = [currFaceNormal];
					}
				};

				// Function that checks if vertex is already in the geometry. If not, adds vertex to the geometry.
				// Returns the three.js vertex index in the geometry vertex array.
				window.stl_reader.vertexHandle = function(split, vert, geometry) {
					var vertIndex = -1;

					var identifier = split.join(",");
					if (window.stl_reader.previousVertices[identifier]) {
						vertIndex = window.stl_reader.previousVertices[identifier];
					}

					if (vertIndex === -1) {
						vertIndex = geometry.vertices.push(vert);
						window.stl_reader.previousVertices[identifier] = vertIndex;
					}

					return vertIndex;
				};

				window.stl_reader.vertIndex = new Array(3);
				window.stl_reader.previousVertices = {};

				if (evt.target.result.substr(0,5) === "solid") {
					asciiHandle(evt);
				} else {
					binaryHandle(evt);
				}
			}

			reader.onerror = function (evt) {
				console.log("error reading file")
			}
		} else {
			console.log("file is not an stl file")
		}
	}
}

// handling ascii format stl file
var asciiHandle = function (evt) {
	// capture vertices and normals with regex
	var vertRegex = /(vertex\s-?[\d\.]+\s-?[\d\.]+\s-?[\d\.]+)/g;
	var vertMatches = evt.target.result.match(vertRegex);

	var normRegex = /(facet\snormal\s-?[\d\.]+\s-?[\d\.]+\s-?[\d\.]+)/g;
	var normMatches = evt.target.result.match(normRegex);

	var geometry = window.stl_reader.geometry;
	var lines = window.stl_reader.lines;
	var vertices = window.stl_reader.vertices;
	var lineHandle = window.stl_reader.lineHandle;
	var addNormalToVertices = window.stl_reader.addNormalToVertices;
	var vertexHandle = window.stl_reader.vertexHandle;
	var vertIndex = window.stl_reader.vertIndex;

	// stl vertex handling
	for (var i = 0; i < vertMatches.length; i++) {
		split = vertMatches[i].split(" ");

		// since there are only triangles, on every third vertex a face object is made
		var vert = new THREE.Vector3(parseFloat(split[1]),parseFloat(split[2]),parseFloat(split[3]));
		vertIndex[i % 3] = vertexHandle(split, vert, geometry);

		if (i % 3 == 2) {
			// stl normal handling
			normSplit = normMatches[Math.floor(i/3)].split(" ");
			normal = new THREE.Vector3(parseFloat(normSplit[2]),parseFloat(normSplit[3]),parseFloat(normSplit[4]));

			// making three.js face object from last three vertices and adding to the geometry
      var face = new THREE.Face3(vertIndex[0] - 1, vertIndex[1] - 1, vertIndex[2] - 1, normal);
			var currFace = geometry.faces.push(face);
			currFace -= 1;

			// populate the line object
			lineHandle(lines, currFace, vertIndex);

			// populate the vertices object
			var currFaceNormal = geometry.faces[geometry.faces.length - 1].normal;
			addNormalToVertices(vertIndex[0], currFaceNormal);
			addNormalToVertices(vertIndex[1], currFaceNormal);
			addNormalToVertices(vertIndex[2], currFaceNormal);
		}
	}

	// setting each face color to default color (red)
	geometry.faces.forEach(function(face) {
		face.color.setRGB(1,0,0);
	});


    //var mesh1 = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color: 0xbfbfbf,vertexColors: THREE.FaceColors, opacity: 0.7, transparent: false}));
    var mesh1 = new THREE.Mesh(geometry,materialSTL);
    
        mesh1.position.set(0,0,0);
    	mesh1.receiveShadow = true;
	    mesh1.castShadow = true;
        


	//var mesh2 = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x595959, wireframe: false}));
    var mesh2 = new THREE.Mesh(geometry,materialSTL);
    
        mesh2.position.set(0,0,0);
    	mesh2.receiveShadow = true;
	    mesh2.castShadow = true;
    



	scene.add(mesh1,groundMesh);
 
	scene.add(mesh2,groundMesh);

	// Filling statistics in sidebar and calculating regular faces, vertices, and lines
	//postProcess(mesh1, lines, vertices);
}


// handling binary format stl file
// the code for this part was copied from:
// http://tonylukasavage.com/blog/2013/04/10/web-based-stl-viewing-three-dot-js/
// and modified
var binaryHandle = function (evt) {
	var reader = new FileReader();
	reader.readAsArrayBuffer(file);
	reader.onload = function (evt) {
		var stl = evt.target.result

	  // The stl binary is read into a DataView for processing
    var dv = new DataView(stl, 80); // 80 == unused header
    var isLittleEndian = true;

    // Read a 32 bit unsigned integer
    var triangles = dv.getUint32(0, isLittleEndian);

    var offset = 4;
    var previousVertices = {};

    var geometry = window.stl_reader.geometry;
		var lines = window.stl_reader.lines;
		var vertices = window.stl_reader.vertices;
		var lineHandle = window.stl_reader.lineHandle;
		var addNormalToVertices = window.stl_reader.addNormalToVertices;
		var vertexHandle = window.stl_reader.vertexHandle;
		var vertIndex = window.stl_reader.vertIndex;

    for (var i = 0; i < triangles; i++) {
      // Get the normal for this triangle by reading 3 32 but floats
      var normal = new THREE.Vector3(
        dv.getFloat32(offset, isLittleEndian),
        dv.getFloat32(offset+4, isLittleEndian),
        dv.getFloat32(offset+8, isLittleEndian)
      );
      offset += 12;

      var vertIndex = new Array(3);

      // Get all 3 vertices for this triangle, each represented
      // by 3 32 bit floats.
      for (var j = 0; j < 3; j++) {
				var vert = new THREE.Vector3(
            dv.getFloat32(offset, isLittleEndian),
            dv.getFloat32(offset+4, isLittleEndian),
            dv.getFloat32(offset+8, isLittleEndian)
          );

				var identifierArray = [
						dv.getInt32(offset, isLittleEndian).toString(),
						dv.getInt32(offset + 4, isLittleEndian).toString(),
						dv.getInt32(offset + 8, isLittleEndian).toString()
					];

				vertIndex[j] = vertexHandle(identifierArray, vert, geometry);

        offset += 12;
      }

      // there's also a Uint16 "attribute byte count" that we
      // don't need, it should always be zero.
      offset += 2;

      // Create a new face for from the vertices and the normal
      var face = new THREE.Face3(vertIndex[0] - 1, vertIndex[1] - 1, vertIndex[2] - 1, normal);
      var currFace = geometry.faces.push(face);
      currFace -= 1;

      lineHandle(lines, currFace, vertIndex);

      var currFaceNormal = geometry.faces[geometry.faces.length - 1].normal;
			addNormalToVertices(vertIndex[0], currFaceNormal);
			addNormalToVertices(vertIndex[1], currFaceNormal);
			addNormalToVertices(vertIndex[2], currFaceNormal);
    }

    geometry.faces.forEach(function(face) {
		
				face.color.setRGB(1,0,0);
		});


    //var mesh1 = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color: 0xbfbfbf,solid:true,vertexColors: 0x12aa00, opacity: 0.9, transparent: false}));
    var mesh1 = new THREE.Mesh(geometry,materialSTL);
        
        mesh1.position.set(0,0,0);
        mesh1.receiveShadow = true;
	    mesh1.castShadow = true;
        

    //var mesh2 = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x595959,wireframe:false}));
    var mesh2 = new THREE.Mesh(geometry,materialSTL);
        mesh2.position.set(0,0,0);
        mesh2.receiveShadow = true;
	    mesh2.castShadow = true;
        

            
 

		scene.add(mesh1,groundMesh);
  //  scene.add(line);
		scene.add(mesh2,groundMesh);

		//postProcess(mesh1, lines, vertices);
	}
}


// function that removes previously loaded solids and canvas listener
var removePrevious = function () {
	for (var i = scene.children.length - 1; i >= 0; i--) {
		if (scene.children[i].type == "Mesh") {
			scene.remove(scene.children[i]);
		}
	}

	$("canvas").off("click");
}

// checks if two vectors or vertices are the same by checking with 0.0001 accuracy
var isSameVectorOrVertex = function (vector1, vector2) {
	var condx = Math.abs(vector1.x - vector2.x) < 0.0001;
	var condy = Math.abs(vector1.y - vector2.y) < 0.0001;
	var condz = Math.abs(vector1.z - vector2.z) < 0.0001;

	return condx && condy && condz;
}

// setting up face selecting clikc event
var faceSelectionSetup = function(regFaces, geometry) {
	// raycaster is used to find faces that the mouse is intersecting when the user clicks
	var raycaster = new THREE.Raycaster();
	var intersected;

	// When the user clicks, faces that were intersected are found.
	// The color of the very first face that is intersected is changed to yellow or red.
	$("canvas").on("click", function(event) {
		var sidebarWidth = $("div.sidebar").width();
		mouse.x = ((event.clientX - sidebarWidth) / (window.innerWidth - sidebarWidth)) * 2 - 1;
		mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
		var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);

		raycaster.ray.set(camera.position, vector.sub(camera.position).normalize());
		var intersects = raycaster.intersectObjects(scene.children);

		// function that changes color of a face
		var triangleFaceColorChanger = function(face) {
			console.log(face)
			if (face.color.g === 1) {
				face.color.setRGB(1,0,0);
			} else {
				face.color.setRGB(0,1,0);
			}
		};

		// face selection logic based on the current mode
		if (intersects.length > 0) {
			if (intersected != intersects[ 0 ]) {
				intersected = intersects[ 0 ];
				if ($("div.sidebar div.face-selectors button.selected")[0].classList[0] === "triangle") {
					triangleFaceColorChanger(intersected.face);
					geometry.colorsNeedUpdate = true;
				} else {
					var intersectedRegFace;
					regFaces.every(function(regFace) {
						var isFace;
						regFace.every(function(faceIndex) {
							if (faceIndex === intersected.faceIndex) {
								isFace = true;
								return false;
							} else {
								return true;
							}
						});

						if (isFace) {
							intersectedRegFace = regFace;
							return false;
						} else {
							return true;
						}
					});

					intersectedRegFace.forEach(function(faceIndex) {
						triangleFaceColorChanger(geometry.faces[faceIndex]);
					});

					geometry.colorsNeedUpdate = true;
				}
			}
		} else {
			intersected = null;
		}
	});
};

var mouse = { x: 0, y: 0 }

// mouse x position used for sizing the sidebar
$(document).on("mousemove", function(event) {
	mouse.realX = event.clientX;
});

// changing the three.js renderer and camera when the window is resized or the sidebar size is changed
var threeResizer = function() {
	var sidebarWidth = $("div.sidebar").width();

	camera.aspect = (window.innerWidth - sidebarWidth) / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( (window.innerWidth - sidebarWidth), window.innerHeight);

	$("canvas").css("left", sidebarWidth);
}

$(window).on("resize", function() {
	threeResizer();
});

// code for resizing of sidebar
$("div.sidebar div.expander").on("mousedown", function(event) {
	event.preventDefault();
	var resizing = function(event) {
		$("div.sidebar").width(mouse.realX);
		if (mouse.realX > 200) {
			$("div.sidebar div.expander").css("left", mouse.realX);
		} else {
			$("div.sidebar div.expander").css("left", 200);
		}

		threeResizer();
	};
	$(window).on("mousemove", resizing);

	$(window).one("mouseup", function(event) {
		$(window).off("mousemove", resizing);
	});
});

// changing face selection mode
$("div.sidebar div.face-selectors button").on("click", function(event) {
	$(event.currentTarget).addClass("selected");
	if ($(event.currentTarget)[0].classList[0] === "triangle") {
		$("div.sidebar div.face-selectors button.regular").removeClass("selected");
	} else {
		$("div.sidebar div.face-selectors button.triangle").removeClass("selected");
	}
});
