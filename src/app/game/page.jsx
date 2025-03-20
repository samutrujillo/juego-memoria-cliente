'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import PlayerList from '@/components/PlayerList';
import Tile from '@/components/Tile';
import AdminButton from '@/components/AdminButton';
import '@/styles/GameBoard.css';
import config from '@/config';

let socket;

export default function Game() {
  // Función para generar un tablero local con distribución perfecta
  const generateLocalBoard = () => {
    const localBoard = [];
    
    // Para cada hilera
    for (let row = 0; row < 4; row++) {
      const rowTiles = [];
      
      // Crear 2 fichas ganadoras y 2 perdedoras para esta hilera
      for (let i = 0; i < 2; i++) {
        rowTiles.push({ value: 15000, revealed: false });
      }
      for (let i = 0; i < 2; i++) {
        rowTiles.push({ value: -15000, revealed: false });
      }
      
      // Mezclarlas
      for (let i = rowTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rowTiles[i], rowTiles[j]] = [rowTiles[j], rowTiles[i]];
      }
      
      // Añadirlas al tablero
      localBoard.push(...rowTiles);
    }
    
    return localBoard;
  };

  const [board, setBoard] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [score, setScore] = useState(60000);
  const [localScore, setLocalScore] = useState(60000); // Puntaje local
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(4);
  const [gameStatus, setGameStatus] = useState('playing');
  const [user, setUser] = useState(null);
  const [rowSelections, setRowSelections] = useState([0, 0, 0, 0]);
  const [canSelectTiles, setCanSelectTiles] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSelectedTile, setLastSelectedTile] = useState(null);
  const [turnNotification, setTurnNotification] = useState('');
  
  // Estado para alertas
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  // Estado para modal de administrador
  const [showAdminModal, setShowAdminModal] = useState(false);
  
  const router = useRouter();
  
  // Referencias para los sonidos (ignoraremos los errores por ahora)
  const winSoundRef = useRef(null);
  const loseSoundRef = useRef(null);
  const turnSoundRef = useRef(null);

  // Función segura para reproducir sonidos (ignora errores)
  const playSoundSafely = (audioRef, volume = 1.0) => {
    if (audioRef && audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.currentTime = 0;
      
      // Usar Promise.catch para manejar errores silenciosamente
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Error reproduciendo sonido (ignorado):', error);
          // No hacer nada en caso de error, permitiendo que el juego continúe
        });
      }
    }
  };

  // Debug useEffect para el estado del usuario
  useEffect(() => {
    if (user) {
      console.log("Renderizando Game.jsx con usuario:", user);
      console.log("Nombre de usuario:", user?.username);
    }
  }, [user]);

  // Función para mostrar la alerta
  const showPointsAlert = (points) => {
    const isPositive = points > 0;
    setAlertType(isPositive ? 'success' : 'error');
    setAlertMessage(isPositive ? `¡Ganaste ${points} puntos!` : `¡Perdiste ${Math.abs(points)} puntos!`);
    setShowAlert(true);
    
    // Reproducir el sonido correspondiente (usando la función segura)
    if (isPositive) {
      playSoundSafely(winSoundRef);
    } else {
      playSoundSafely(loseSoundRef);
    }
    
    // Ocultar la alerta después de 2 segundos sin detener el juego
    setTimeout(() => {
      setShowAlert(false);
    }, 2000);
  };

  // Función para mostrar notificaciones de acciones de otros jugadores
  const showPlayerActionNotification = (username, value) => {
    const isPositive = value > 0;
    const message = isPositive 
      ? `${username} ganó ${value} puntos` 
      : `${username} perdió ${Math.abs(value)} puntos`;
    
    // Mostrar una notificación temporal
    setMessage(message);
    setTimeout(() => setMessage(''), 2000);
  };

  // Función para mostrar notificación de cambio de turno
  const showTurnNotification = (player, isYourTurnNow) => {
    if (isYourTurnNow) {
      setTurnNotification('¡Es tu turno ahora!');
      // Reproducir sonido de turno (usando la función segura)
      playSoundSafely(turnSoundRef);
    } else {
      setTurnNotification(`Turno de ${player.username}`);
    }
    // Mostrar la notificación por 3 segundos
    setTimeout(() => {
      setTurnNotification('');
    }, 3000);
  };

  // Función para reiniciar el tablero local
  const resetLocalBoard = () => {
    console.log("Reiniciando tablero local...");
    const newBoard = generateLocalBoard();
    setBoard(newBoard);
    setRowSelections([0, 0, 0, 0]);
  };

  // Función mejorada para actualizar el puntaje local con persistencia
  const updateLocalScore = (newScore) => {
    setLocalScore(newScore);
    
    try {
      const userData = sessionStorage.getItem('user');
      if (userData) {
        const userObj = JSON.parse(userData);
        userObj.score = newScore;
        sessionStorage.setItem('user', JSON.stringify(userObj));
        console.log('Puntaje actualizado en sessionStorage:', newScore);
        
        // Verificar que se guardó correctamente
        const checkData = sessionStorage.getItem('user');
        if (checkData) {
          const checkObj = JSON.parse(checkData);
          if (checkObj.score !== newScore) {
            console.warn('Verificación fallida: el puntaje no se guardó correctamente');
          }
        }
      } else {
        console.warn('No se encontraron datos de usuario en sessionStorage');
      }
    } catch (error) {
      console.error('Error actualizando sessionStorage:', error);
    }
  };

  // Función para abrir el modal de administrador
  const handleAdminPanel = () => {
    console.log("Abriendo panel de administración");
    console.log("Estado del usuario:", user);
    setShowAdminModal(true);
  };

  useEffect(() => {
    // Recuperar datos de usuario de sessionStorage
    const userData = sessionStorage.getItem('user');
    if (!userData) {
      console.log('No hay datos de usuario en sessionStorage');
      router.push('/');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      console.log('Usuario recuperado de sessionStorage:', parsedUser);
      
      setUser(parsedUser);
      setScore(parsedUser.score || 60000);
      setLocalScore(parsedUser.score || 60000); // Inicializar el puntaje local

      if (parsedUser.isBlocked) {
        setMessage('Tu cuenta está bloqueada. Contacta al administrador.');
        return;
      }

      // Establecer un tablero local con distribución perfecta
      const initialBoard = generateLocalBoard();
      setBoard(initialBoard);

      // Inicializar socket con la configuración centralizada
      console.log('Iniciando conexión con Socket.io a:', config.socketServerUrl);
      socket = io(config.socketServerUrl, config.socketOptions);

      // Añadir manejo específico de errores
      socket.on('error', (error) => {
        console.error('Error de socket:', error);
      });

      socket.io.on('error', (error) => {
        console.error('Error de conexión:', error);
      });

      socket.on('connect', () => {
        setIsConnected(true);
        console.log('Conectado al servidor Socket.io con ID:', socket.id);
        
        // Al conectarse, solicitar una sincronización de puntaje
        if (parsedUser && parsedUser.id) {
          socket.emit('syncScore', { userId: parsedUser.id });
          console.log('Solicitando sincronización de puntaje para usuario:', parsedUser.id);
        }
        
        // Una vez conectado, unirse al juego
        socket.emit('joinGame');
        console.log('Evento joinGame enviado');
        
        // Forzar el estado local a 'playing'
        setGameStatus('playing');
        
        // Si hay un solo jugador, establecer isYourTurn a true
        if (players.length <= 1) {
          setIsYourTurn(true);
        }
      });

      // Mejor manejo de errores de conexión
      socket.on('connect_error', (err) => {
        console.error('Error de conexión Socket.io:', err);
        setIsConnected(false);
        setMessage('Error de conexión con el servidor. Reintentando...');
        
        // Reintentar conexión automáticamente
        setTimeout(() => {
          if (!socket.connected) {
            console.log("Reintentando conexión...");
            socket.connect();
          }
        }, 2000);
      });

      // Manejo de cierre de sesión
      socket.on('sessionClosed', (message) => {
        alert(message);
        router.push('/');
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconectado después de ${attemptNumber} intentos`);
        setIsConnected(true);
        
        // Al reconectar, volver a unirse al juego
        socket.emit('joinGame');
      });

      socket.on('gameState', (gameState) => {
        console.log('Recibido gameState:', gameState);
        
        // Forzar gameState.status a 'playing' si solo hay un jugador
        if (gameState.players && gameState.players.length <= 1) {
          gameState.status = 'playing';
        }
        
        // Si el tablero está vacío o todos los valores están revelados, generar uno nuevo
        let needsNewBoard = false;
        
        if (!gameState.board || gameState.board.length === 0) {
          needsNewBoard = true;
        } else {
          // Verificar si todas las fichas ya están reveladas
          const allRevealed = gameState.board.every(tile => tile.revealed);
          if (allRevealed) {
            needsNewBoard = true;
          }
        }
        
        if (needsNewBoard) {
          console.log("Generando nuevo tablero local...");
          // Generar un nuevo tablero con distribución perfecta
          const newBoard = generateLocalBoard();
          
          // Copiar estados de revelación si existen
          if (gameState.board && gameState.board.length > 0) {
            for (let i = 0; i < Math.min(newBoard.length, gameState.board.length); i++) {
              if (gameState.board[i].revealed) {
                newBoard[i].revealed = true;
              }
            }
          }
          
          setBoard(newBoard);
        } else {
          // Si no necesitamos un tablero nuevo, actualizar el estado de revelación
          setBoard(prev => {
            const updatedBoard = [...prev];
            for (let i = 0; i < Math.min(updatedBoard.length, gameState.board.length); i++) {
              if (gameState.board[i].revealed) {
                updatedBoard[i] = {
                  ...updatedBoard[i],
                  revealed: true
                };
              }
            }
            return updatedBoard;
          });
        }
        
        // Verificar si ha cambiado el jugador actual
        const prevPlayerId = currentPlayer?.id;
        const newPlayerId = gameState.currentPlayer?.id;
        
        // Actualizar el estado del juego
        setCurrentPlayer(gameState.currentPlayer);
        setPlayers(gameState.players || []);
        setGameStatus(gameState.status || 'playing'); // Usar 'playing' como valor predeterminado
        
        // Si solo hay un jugador, siempre es su turno mientras el juego esté en progreso
        const isCurrentUserTurn = (gameState.players && gameState.players.length <= 1) || 
          (gameState.currentPlayer && gameState.currentPlayer.id === parsedUser.id);
        
        // Mostrar notificación si cambió el jugador actual
        if (prevPlayerId !== newPlayerId && gameState.currentPlayer) {
          showTurnNotification(gameState.currentPlayer, isCurrentUserTurn);
        }
        
        setIsYourTurn(isCurrentUserTurn);
        
        // Reset timer when it becomes user's turn
        if (isCurrentUserTurn) {
          console.log('Es mi turno ahora');
          setTimeLeft(4);
          setCanSelectTiles(true); // Permitir selección al iniciar nuevo turno
        }
        
        // Actualizar contador de selecciones por hilera
        if (gameState.rowSelections) {
          setRowSelections(gameState.rowSelections);
        }
      });

      // Nuevo evento para actualización directa del puntaje
      socket.on('directScoreUpdate', (newScore) => {
        console.log(`Actualización directa de puntaje: ${newScore}`);
        // Este evento ahora actualiza ambos puntajes - local y remoto
        setScore(newScore);
        updateLocalScore(newScore);
      });

      socket.on('forceScoreUpdate', (newScore) => {
        console.log(`FORZANDO actualización de puntaje a: ${newScore}`);
        // Actualizar ambos puntajes
        setScore(newScore);
        updateLocalScore(newScore);
      });

      socket.on('scoreUpdate', (data) => {
        console.log('Actualización de puntaje recibida:', data);
        
        // Si es un objeto con userId, verificar que sea para este usuario
        if (typeof data === 'object' && data.userId) {
          if (data.userId === parsedUser.id) {
            console.log(`Actualizando mi puntaje a ${data.newScore}`);
            setScore(data.newScore);
            updateLocalScore(data.newScore);
          }
        } else {
          // Si es solo un número, actualizar directamente
          console.log(`Actualizando mi puntaje a ${data}`);
          setScore(data);
          updateLocalScore(data);
        }
      });

      socket.on('tileSelected', ({ tileIndex, tileValue, playerId, newScore, rowSelections, soundType, playerUsername, timestamp }) => {
        console.log(`${playerUsername} seleccionó la ficha ${tileIndex}, valor ${tileValue}`);
        
        // Actualizar el tablero para todos los jugadores
        setBoard(prevBoard => {
          const newBoard = [...prevBoard];
          if (newBoard[tileIndex]) {
            newBoard[tileIndex] = { 
              ...newBoard[tileIndex], 
              revealed: true, 
              value: newBoard[tileIndex].value,
              lastSelected: true // Marcar como última seleccionada para animación
            };
          }
          return newBoard;
        });
        
        // Guardar info para animación
        setLastSelectedTile({
          index: tileIndex,
          playerId: playerId,
          playerUsername: playerUsername,
          timestamp: timestamp
        });
        
        // Reproducir el sonido adecuado (usando la función segura)
        const isCurrentPlayer = playerId === parsedUser.id;
        
        if (soundType === 'win') {
          playSoundSafely(winSoundRef, isCurrentPlayer ? 1.0 : 0.3);
        } else if (soundType === 'lose') {
          playSoundSafely(loseSoundRef, isCurrentPlayer ? 1.0 : 0.3);
        }
        
        // Si es mi ficha seleccionada, actualizar puntaje local
        if (isCurrentPlayer) {
          // Usar el valor de nuestro tablero local
          const localTileValue = board[tileIndex]?.value || 0;
          
          // Mostrar alerta con el valor local
          showPointsAlert(localTileValue);
          
          console.log(`Actualizando mi puntaje local desde tileSelected a ${newScore}`);
          updateLocalScore(newScore);
        } else {
          // Mostrar notificación de selección de otro jugador
          showPlayerActionNotification(playerUsername, tileValue);
        }
        
        // Actualizar contador de selecciones por hilera
        if (rowSelections) {
          setRowSelections(rowSelections);
        }
      });

      socket.on('turnTimeout', ({ playerId }) => {
        console.log(`Tiempo agotado para jugador ${playerId}`);
        
        // Si era mi turno, mostrar mensaje y bloquear selección
        if (playerId === parsedUser.id) {
          console.log('Mi tiempo se agotó');
          setTimeLeft(0);
          setCanSelectTiles(false);
          
          // No establecer isYourTurn a false si eres el único jugador
          if (players.length > 1) {
            setIsYourTurn(false);
          } else {
            setIsYourTurn(true); // Mantener el turno si eres el único jugador
          }
          
          setMessage('¡Tu tiempo se agotó!');
          setTimeout(() => setMessage(''), 2000);
        }
      });

      socket.on('blocked', () => {
        setMessage('Tu cuenta ha sido bloqueada por el administrador.');
        setTimeout(() => {
          router.push('/');
        }, 3000);
      });

      socket.on('message', (newMessage) => {
        setMessage(newMessage);
        setTimeout(() => setMessage(''), 2000);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
        console.log('Desconectado del servidor');
      });

      // Cleanup on unmount
      return () => {
        console.log('Desconectando Socket.io...');
        if (socket) {
          socket.off('connect');
          socket.off('connect_error');
          socket.off('gameState');
          socket.off('tileSelected');
          socket.off('turnTimeout');
          socket.off('scoreUpdate');
          socket.off('forceScoreUpdate');
          socket.off('directScoreUpdate');
          socket.off('blocked');
          socket.off('message');
          socket.off('sessionClosed');
          socket.emit('leaveGame');
          socket.disconnect();
          console.log('Socket desconectado');
        }
      };
    } catch (error) {
      console.error('Error al procesar datos de usuario:', error);
      router.push('/');
    }
  }, [router]);

  // Efecto para el temporizador
  useEffect(() => {
    let timer;
    
    if (isYourTurn) { // Simplificado: siempre que sea tu turno, independientemente del estado
      console.log('Iniciando temporizador de 4 segundos para mi turno');
      // Iniciar con 4 segundos
      setTimeLeft(4);
      setCanSelectTiles(true);
      
      // Actualizar cada segundo
      timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          console.log(`Temporizador: ${prevTime} segundos`);
          if (prevTime <= 1) {
            console.log('Mi tiempo se agotó');
            clearInterval(timer);
            setCanSelectTiles(false);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      // Si no es mi turno, asegurar que el contador esté limpio
      clearInterval(timer);
    }
    
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isYourTurn]);

  // Función modificada para manejar clics en fichas con puntaje local
  const handleTileClick = (index) => {
    console.log(`Intentando seleccionar ficha ${index}`);
    
    // Verificar si ya está revelada
    if (board[index]?.revealed) {
      console.log("Esta ficha ya está revelada");
      return;
    }
    
    // Verificar si puede seleccionar fichas (tiempo no agotado)
    if (!canSelectTiles) {
      console.log("No puedes seleccionar más fichas en este turno");
      setMessage("¡No puedes seleccionar más fichas en este turno!");
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    
    // Verificar si es mi turno (solo importa si hay más de un jugador)
    if (!isYourTurn && players.length > 1) {
      console.log("No es tu turno para seleccionar una ficha");
      setMessage("¡Espera tu turno!");
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    
    // Verificar si el tiempo está agotado
    if (timeLeft <= 0) {
      console.log("Tiempo agotado para seleccionar fichas");
      setMessage("¡Tiempo agotado para este turno!");
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    
    // Determinar a qué hilera pertenece esta ficha
    const row = Math.floor(index / 4);
    
    // Verificar si ya se seleccionaron 2 fichas de esta hilera
    if (rowSelections[row] >= 2) {
      console.log(`Ya has seleccionado 2 fichas de la hilera ${row + 1}`);
      setMessage(`¡Límite de 2 fichas por hilera alcanzado en hilera ${row + 1}!`);
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    
    // Lógica adicional para manejar puntaje localmente
    const tileValue = board[index]?.value || 0;
    if (!board[index]?.revealed) {
      // Calcular nuevo puntaje localmente
      const newScore = localScore + tileValue;
      updateLocalScore(newScore);
      
      // Reproducir sonido según valor (usando la función segura)
      if (tileValue > 0) {
        playSoundSafely(winSoundRef);
      } else {
        playSoundSafely(loseSoundRef);
      }
      
      // Mostrar mensaje de puntos ganados/perdidos
      const messageText = tileValue > 0 
        ? `¡Ganaste ${tileValue} puntos!` 
        : `Perdiste ${Math.abs(tileValue)} puntos`;
      setMessage(messageText);
      setTimeout(() => setMessage(''), 2000);
      
      // Actualizar el tablero localmente
      setBoard(prevBoard => {
        const newBoard = [...prevBoard];
        if (newBoard[index]) {
          newBoard[index] = { 
            ...newBoard[index], 
            revealed: true,
            lastSelected: true
          };
        }
        return newBoard;
      });
      
      // Actualizar contador de selecciones por hilera
      setRowSelections(prev => {
        const updated = [...prev];
        updated[row]++;
        return updated;
      });
    }
    
    // Enviar el evento al servidor para actualizar otros jugadores
    console.log(`Enviando selección de ficha al servidor. Estado: ${gameStatus}, isYourTurn: ${isYourTurn}`);
    socket.emit('selectTile', { tileIndex: index });
  };

  if (!user) {
    return <div className="loading">Cargando...</div>;
  }

  console.log("Renderizando Game.jsx con usuario:", user);
  console.log("Nombre de usuario:", user?.username);

  return (
    <>
      {/* Botón flotante para admin que siempre estará visible */}
      {user?.username === "admin" && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#ff4081',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '4px',
            fontWeight: 'bold',
            zIndex: 10000,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}
          onClick={handleAdminPanel}
        >
          Panel de Admin
        </div>
      )}
    
      <div className="game-container">
        {/* Sonidos para las fichas y notificaciones */}
        <audio ref={winSoundRef} src="/sounds/win.mp3" preload="auto"></audio>
        <audio ref={loseSoundRef} src="/sounds/lose.mp3" preload="auto"></audio>
        <audio ref={turnSoundRef} src="/sounds/turn.mp3" preload="auto"></audio>
        
        {/* Notificación de cambio de turno */}
        {turnNotification && (
          <div className="turn-notification" style={{
            position: 'fixed',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(25, 118, 210, 0.9)',
            color: 'white',
            padding: '15px 30px',
            borderRadius: '8px',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            animation: 'fadeInOut 3s ease'
          }}>
            {turnNotification}
          </div>
        )}
        
        {/* Alerta para puntos ganados/perdidos */}
        {showAlert && (
          <div className={`points-alert ${alertType}`}>
            {alertMessage}
          </div>
        )}
        
        <div className="game-info">
          <h2>Jugador: {user?.username}</h2>
          
          {isConnected ? (
            <div className="connection-status connected">Conectado al servidor</div>
          ) : (
            <div className="connection-status disconnected">Desconectado del servidor</div>
          )}
          
          <div className="game-score">
            Puntaje: {localScore}
          </div>

          {currentPlayer && (
            <div className="current-player">
              Jugador actual: {currentPlayer.username}
              {isYourTurn && <span className="your-turn"> (¡Tu turno!)</span>}
            </div>
          )}

          <div className="time-display">
            {isYourTurn ? (
              <>Tiempo restante: <span className={`timer-value ${timeLeft === 0 ? 'time-up' : ''}`}>{timeLeft}</span> segundos</>
            ) : (
              players.length <= 1 ? "¡Tu turno!" : "Esperando turno..."
            )}
          </div>

          <div className="rows-info">
            Límites por hilera: 
            {rowSelections.map((count, index) => (
              <span key={index} className={count >= 2 ? 'row-limit-reached' : ''}>
                Hilera {index + 1}: {count}/2
              </span>
            ))}
          </div>

          {message && <div className="message">{message}</div>}
        </div>

        <div className="game-board">
          {Array.isArray(board) && board.length > 0 ? (
            board.map((tile, index) => (
              <Tile
                key={index}
                index={index}
                revealed={tile?.revealed || false}
                value={tile?.value || 0}
                onClick={() => handleTileClick(index)}
                disabled={
                  tile?.revealed || 
                  !canSelectTiles || 
                  timeLeft <= 0 || 
                  rowSelections[Math.floor(index / 4)] >= 2
                }
                lastSelected={lastSelectedTile?.index === index}
              />
            ))
          ) : (
            <div className="loading-message">
              Cargando tablero...
              <button
                onClick={() => {
                  if (socket) {
                    socket.emit('joinGame');
                  }
                }}
                className="retry-button"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        <div className="players-section">
          <h3>Jugadores conectados</h3>
          <PlayerList players={players} currentPlayerId={currentPlayer?.id} />
        </div>
        
        {/* Modal de administrador */}
        {showAdminModal && (
          <AdminButton 
            onClose={() => setShowAdminModal(false)} 
            socket={socket}
          />
        )}
      </div>
    </>
  );
}