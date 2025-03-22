import './globals.css';

export const metadata = {
  title: 'Juego de Memoria Multijugador',
  description: 'Juego multijugador en tiempo real con Next.js y Socket.io',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="app-container">
          <div className="app-title">
            <img src="/images/logo.jpeg" alt="FTAPP GAME" className="logo-image" />
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}