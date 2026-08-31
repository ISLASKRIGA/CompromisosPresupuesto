import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = r"c:\Users\chuch\.gemini\antigravity\playground\CompromisosPresupuesto"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Servidor ejecutándose en http://localhost:{PORT}")
        print("Abriendo el dashboard en el navegador...")
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")
            sys.exit(0)
