package setdata

default mods = {
	"allow": false,
}

mods = {
	"allow": true,
    "pairs": [{
        "key": input.metadata.key,
        "value": input.metadata.value
    }]
} {
    input.type == "setdata"
}