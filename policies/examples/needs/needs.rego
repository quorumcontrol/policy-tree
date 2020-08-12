package needs

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

mods["needs"] = needs {
	not has_all_needs
    not is_setting_hello
  	needs := {
    	"keys": ["/hello"]
    }
}

mods["allow"] = allow

mods["pairs"] = pairs {
	allow
	pairs := [{
        "key": input.metadata.key,
        "value": input.metadata.value
	}]
}

