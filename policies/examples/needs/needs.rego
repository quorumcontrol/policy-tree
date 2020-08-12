package needs

default mods = {"needs": {"keys": ["/hello"]}}

is_set_data {
	input.type == "setdata"
}

is_setting_hello {
	input.metadata.key == "/hello"
}

has_all_needs {
	input.keys["/hello"]
}

is_correct_key {
	input.keys["/hello"] == "world"
}

allow {
	is_set_data
	is_correct_key
}

allow {
	is_set_data
	is_setting_hello
}

mods = {"allow": false} {
	not allow
	has_all_needs
}

mods = {
	"allow": true,
	"pairs": [{
		"key": input.metadata.key,
		"value": input.metadata.value,
	}],
} {
	allow
}
