window.onload = async (event) => {
	await load();
    document.body.removeChild(document.querySelector(".loader"));
	console.log('page is fully loaded');

    World.start();
    //World.loadScene("Base");
    World.loadScene("Game") // 

    update();
};

function update() {
    World.time = requestAnimationFrame(update);

    Drawing.clear();

    World.objects.forEach(o => o.update());

    World.objects.sort((a, b) => a.z > b.z ? 1 : (a.z < b.z ? -1 : 0));
    World.objects.forEach(o => o.draw());

    for(let i = World.objects.length - 1; i >= 0; i--) {
        if(World.objects[i].killed) 
            World.objects.splice(i, 1);
    }
    
    Input.pressed.clear();
    Input.released.clear();
}

console.log("starting");