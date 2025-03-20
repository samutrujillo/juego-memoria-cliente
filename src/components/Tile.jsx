'use client';

import React from 'react';
import '@/styles/Tile.css';

const Tile = ({ index, revealed, value, onClick, disabled, lastSelected, selectedBy }) => {
  // Determinar la fila basada en el índice
  const row = Math.floor(index / 4);
  
  // Determinar el color basado en la fila (para fichas no reveladas)
  // y en el valor (para fichas reveladas)
  const getColor = () => {
    if (!revealed) {
      // Color por fila cuando no está revelada
      switch(row) {
        case 0: return 'blue';
        case 1: return 'yellow';
        case 2: return 'red';
        case 3: return 'green';
        default: return 'blue';
      }
    } else {
      // Color por valor cuando está revelada
      return value > 0 ? 'green' : 'red';
    }
  };
  
  // Determinar el ícono basado en la fila
  const getIcon = () => {
    if (revealed) return '';
    
    switch(row) {
      case 0: return '💎'; // diamante
      case 1: return '💰'; // bolsa de dinero
      case 2: return '🔴'; // círculo rojo
      case 3: return '🏆'; // trofeo
      default: return '?';
    }
  };
  
  const displayValue = () => {
    if (!revealed) {
      return getIcon();
    }
    
    if (value > 0) {
      return `+${value/1000}K`;
    }
    
    return `${value/1000}K`;
  };
  
  // Determinar las clases de la ficha
  const tileClass = () => {
    const baseClass = `tile ${getColor()}`;
    const classes = [];
    
    if (revealed) {
      classes.push('revealed');
      classes.push(value > 0 ? 'winner' : 'loser');
    }
    
    if (disabled && !revealed) {
      classes.push('disabled');
    }
    
    // Añadir clase para la última ficha seleccionada
    if (lastSelected) {
      classes.push('last-selected');
    }
    
    return `${baseClass} ${classes.join(' ')}`;
  };

  const handleClick = (e) => {
    e.preventDefault();
    if (!disabled) {
      onClick();
    }
  };

  return (
    <div 
      className={tileClass()} 
      onClick={handleClick}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      data-value={value}
      data-row={row}
    >
      {displayValue()}
      {selectedBy && revealed && (
        <div className="selected-by-label">
          {selectedBy}
        </div>
      )}
    </div>
  );
};

export default Tile;