'use client';

import React, { useEffect, useState } from 'react';
import '@/styles/CoinRain.css';

const CoinRain = ({ active, onComplete }) => {
  const [coins, setCoins] = useState([]);
  
  useEffect(() => {
    if (active) {
      // Crear monedas
      const newCoins = [];
      for (let i = 0; i < 50; i++) {
        newCoins.push({
          id: i,
          left: `${Math.random() * 100}%`,
          size: `${Math.random() * 20 + 20}px`,
          delay: `${Math.random() * 2}s`,
          duration: `${Math.random() * 2 + 2}s`
        });
      }
      setCoins(newCoins);
      
      // Terminar la animación después de un tiempo
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);
  
  if (!active) return null;
  
  return (
    <div className="coin-rain-container">
      {coins.map(coin => (
        <div
          key={coin.id}
          className="coin"
          style={{
            left: coin.left,
            width: coin.size,
            height: coin.size,
            animationDelay: coin.delay,
            animationDuration: coin.duration
          }}
        >
          💰
        </div>
      ))}
    </div>
  );
};

export default CoinRain;