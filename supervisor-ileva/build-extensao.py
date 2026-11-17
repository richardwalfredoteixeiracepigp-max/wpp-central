# Gera a extensão própria "Ileva Supervisor" (Chrome/Edge) a partir dos scripts atuais.
#   extensao-gestor/  <- ileva-supervisor-core.js            (versão completa, do gestor)
#   extensao-equipe/  <- ileva-supervisor-colaborador.user.js (versão da equipe)
# e os pacotes Ileva-Supervisor-Extensao-Gestor.zip / Ileva-Supervisor-Extensao-Equipe.zip.
# Rode de novo sempre que o core mudar (depois do gerar-versao-colaborador.py).
# A pasta extensao-gestor é atualizada no lugar: o Chrome percebe a nova versão sozinho em até 1 minuto.
import json, pathlib, re, shutil, sys, zipfile
base = pathlib.Path(__file__).resolve().parent
kit = base / 'extensao-base'

def body(path):
    src = path.read_text(encoding='utf-8')
    m = re.search(r'^\(function \(\) \{', src, re.M)
    if not m: sys.exit(f'ERRO: início do script não encontrado em {path.name}')
    return src, src[m.start():]

def version(src):
    m = re.search(r'@version\s+([0-9.]+)', src)
    return m.group(1) if m else '1.0.0'

def build(variant, script, name, desc):
    src, code = body(base / script)
    ver = version((base / 'ileva-supervisor-core.js').read_text(encoding='utf-8'))
    out = base / f'extensao-{variant}'
    out.mkdir(exist_ok=True)
    (out / 'icons').mkdir(exist_ok=True)
    for f in (kit / 'icons').glob('*.png'):
        shutil.copyfile(f, out / 'icons' / f.name)
    for f in ('background.js', 'flag.js', 'options.html', 'options.css', 'options.js'):
        shutil.copyfile(kit / f, out / f)
    # endereço da planilha para a página de Configurações (lido do próprio script)
    url = re.search(r"const SHARED_URL = '([^']*)'", src); key = re.search(r"const SHARED_KEY = '([^']*)'", src)
    (out / 'config.js').write_text('window.ILEVA_CFG = ' + json.dumps({'url': url.group(1) if url else '', 'key': key.group(1) if key else '', 'variant': variant}) + ';\n', encoding='utf-8')
    prelude = (kit / 'prelude.js').read_text(encoding='utf-8')
    content = prelude + '\n' + code.rstrip() + '\n});\n'
    (out / 'content.js').write_text(content, encoding='utf-8')
    man = {
        'manifest_version': 3,
        'name': name,
        'short_name': 'Ileva',
        'version': ver,
        'description': desc,
        'icons': {'16': 'icons/16.png', '32': 'icons/32.png', '48': 'icons/48.png', '128': 'icons/128.png'},
        'action': {'default_title': name, 'default_icon': {'16': 'icons/16.png', '32': 'icons/32.png'}},
        'background': {'service_worker': 'background.js'},
        'options_page': 'options.html',
        'commands': {'esconder': {'suggested_key': {'default': 'Ctrl+Shift+9'}, 'description': 'Esconder ou mostrar o Supervisor por 5 minutos (print ou gravação de tela)', 'global': True}},
        'permissions': ['storage', 'unlimitedStorage', 'alarms'],
        'host_permissions': ['https://script.google.com/*', 'https://script.googleusercontent.com/*'],
        'content_scripts': [
            {'matches': ['<all_urls>'], 'js': ['flag.js'], 'run_at': 'document_start', 'all_frames': False},
            {'matches': ['<all_urls>'], 'js': ['content.js'], 'run_at': 'document_idle', 'all_frames': False},
        ],
    }
    (out / 'manifest.json').write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding='utf-8')
    (out / 'versao.txt').write_text(ver, encoding='utf-8')  # por último: é o sinal de "nova versão pronta"
    z = base / f'Ileva-Supervisor-Extensao-{variant.capitalize()}.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(out.rglob('*')):
            if f.is_file():
                zf.write(f, f'Ileva-Supervisor-{variant.capitalize()}/' + f.relative_to(out).as_posix())
    print(f'OK {variant}: versão {ver}, content.js {len(content)//1024} KB -> {z.name}')

build('gestor', 'ileva-supervisor-core.js', 'Ileva Supervisor',
      'Painel de atendimentos, reuniões, tarefas e alertas da Ileva no WhatsApp Web e nas outras abas. Somente leitura no WhatsApp.')
build('equipe', 'ileva-supervisor-colaborador.user.js', 'Ileva Supervisor - Equipe',
      'Alertas de atendimentos, reuniões e tarefas da Ileva para a equipe. Somente leitura no WhatsApp.')
