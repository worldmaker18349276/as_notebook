define(['base/js/namespace'], function(Jupyter) {
    function load_ipython_extension() {
        function save() {
            var name = Jupyter.notebook.get_notebook_name();
            if (!confirm(`save as ${name}.py?`)) return;
            var cells = Jupyter.notebook.get_cells();
            var codes = cells.map(cell => {
                var lang = cell.cell_type;
                var code = cell.get_text();
                var magic = "%%";
                if (lang == "code" && code.startsWith("%%script"))
                    [, lang, code] = /^%%script (.*)\n([\s\S]*)/.exec(code);
                if (lang == "code" && code.startsWith("%%"))
                    [, magic, code] = /^(.*)\n([\s\S]*)/.exec(code);

                if (lang == "code")
                    return `# ${magic}\n` + code;
                else if (lang == "markdown")
                    return `# %%markdown\n` + code.replace(/^/mg, "# ");
                else if (lang == "raw")
                    return `# %%raw\n` + code.replace(/^/mg, "# ");
                else
                    return `# %%$script {lang}\n` + code.replace(/^/mg, "# ");
            }).join("\n");
            codes = '"""'
                  + codes.replace(/^# %%\n/, "")
                         .replace(/\\/g, String.raw`\\`)
                         .replace(/"""/g, String.raw`\"\"\"`)
                  + '"""';
            Jupyter.notebook.kernel.execute(`with open('${name}.py', 'w') as file: file.write(${codes})`);
        }

        function load() {
            var name = Jupyter.notebook.get_notebook_name();
            if (!confirm(`load from ${name}.py?`)) return;
            Jupyter.notebook.delete_cells([...Array(Jupyter.notebook.ncells()).keys()]);
            var loader = Jupyter.notebook.get_cell(0);
            loader.set_text(`%load ${name}.py`);
            loader.execute();
            function split_cell() {
                var codes = loader.get_text();
                if (loader.output_area.outputs.length > 0 && loader.output_area.outputs[0].output_type == "error") {
                    return;
                }
                if (!codes.startsWith("# %load")) {
                    setTimeout(split_cell, 10);
                    return;
                }

                codes = codes.replace(/^# %load .*/, "")
                             .replace(/^\n(?!# %%.+\n)/, "\n# %%\n");
                for (let code of codes.split(/\n(?=# %%.*\n)/g).slice(1)) {
                    var match, lang, magic_name;

                    if (match = /# %%markdown\n([\s\S]*)/.exec(code)) {
                        [, code] = match;
                        code = code.replace(/^# /mg, "");
                        var cell = Jupyter.notebook.insert_cell_at_bottom("markdown");
                        cell.set_text(code);
                        cell.execute();

                    } else if (match = /# %%raw\n([\s\S]*)/.exec(code)) {
                        [, code] = match;
                        code = code.replace(/^# /mg, "");
                        var cell = Jupyter.notebook.insert_cell_at_bottom("raw");
                        cell.set_text(code);

                    } else if (match = /# %%script (.*)\n([\s\S]*)/.exec(code)) {
                        [, lang, code] = match;
                        code = `%%script ${lang}\n` + code.replace(/^# /mg, "");
                        var cell = Jupyter.notebook.insert_cell_at_bottom("code");
                        cell.set_text(code);

                    } else if (match = /# %%(.*)\n([\s\S]*)/.exec(code)) {
                        [, magic_name, code] = match;
                        if (magic_name != "")
                            code = `%%${magic_name}\n` + code;
                        var cell = Jupyter.notebook.insert_cell_at_bottom("code");
                        cell.set_text(code);

                    }

                }
                
                Jupyter.notebook.delete_cell(0);
            }
            split_cell();
        }

        var savepy = Jupyter.keyboard_manager.actions.register({
            help       : 'Save *.ipynb as *.py',
            help_index : 'zz',
            handler    : save
        }, 'save-ipynb-as-py', 'as_notebook');
        var loadpy = Jupyter.keyboard_manager.actions.register({
            help       : 'Load *.py as *.ipynb',
            help_index : 'zz',
            handler    : load
        }, 'load-py-as-ipynb', 'as_notebook');

        Jupyter.keyboard_manager.command_shortcuts.add_shortcuts({
            'shift-s' : savepy,
            'shift-l' : loadpy
        });
    }

    return {
        load_ipython_extension: load_ipython_extension
    };
});