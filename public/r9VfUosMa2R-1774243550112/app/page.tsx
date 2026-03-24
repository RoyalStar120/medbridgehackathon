'use client'

import React, { useState } from 'react'
import { Plane, Bluetooth, Wifi, Moon } from 'lucide-react'
import { LiquidButton } from './components/liquid-button'
import { LiquidGlass } from './components/liquid-glass'

export default function Page() {
  const [toggleStates, setToggleStates] = useState({
    airplane: false,
    airdrop: false,
    wifi: true,
    dnd: false,
  })

  const buttons = [
    {
      id: 'airplane',
      icon: Plane,
      label: 'Airplane Mode',
      activeBackground:
        'linear-gradient(135deg, rgba(249, 115, 22, 0.7) 0%, rgba(234, 88, 12, 0.7) 100%)',
      activeBorder: 'rgba(251, 146, 60, 0.8)',
      active: toggleStates.airplane,
    },
    {
      id: 'airdrop',
      icon: Bluetooth,
      label: 'AirDrop',
      activeBackground:
        'linear-gradient(135deg, rgba(59, 130, 246, 0.7) 0%, rgba(37, 99, 235, 0.7) 100%)',
      activeBorder: 'rgba(96, 165, 250, 0.8)',
      active: toggleStates.airdrop,
    },
    {
      id: 'wifi',
      icon: Wifi,
      label: 'Wi-Fi',
      activeBackground:
        'linear-gradient(135deg, rgba(59, 130, 246, 0.7) 0%, rgba(37, 99, 235, 0.7) 100%)',
      activeBorder: 'rgba(96, 165, 250, 0.8)',
      active: toggleStates.wifi,
    },
    {
      id: 'dnd',
      icon: Moon,
      label: 'Do Not Disturb',
      activeBackground:
        'linear-gradient(135deg, rgba(168, 85, 247, 0.7) 0%, rgba(147, 51, 234, 0.7) 100%)',
      activeBorder: 'rgba(196, 181, 253, 0.8)',
      active: toggleStates.dnd,
    },
  ]

  const handleToggle = (buttonId: string) => {
    setToggleStates((prev) => ({
      ...prev,
      [buttonId]: !prev[buttonId as keyof typeof prev],
    }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
      <div
        className="fixed left-0 top-0 right-0 bottom-0 w-full h-full bg-cover bg-center bg-no-repeat z-10"
        style={{
          backgroundImage: `url('https://picsum.photos/1920/1080')`,
        }}
      />

      <div className="absolute inset-0 bg-black/20" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-400/5 rounded-full blur-2xl animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <LiquidGlass
        variant="panel"
        intensity="medium"
        rippleEffect={false}
        flowOnHover={false}
        stretchOnDrag={false}
        className="relative z-20"
        style={{ padding: '24px', borderRadius: '64px' }}
      >
        <div className="grid grid-cols-2 relative">
          {buttons.map((button) => {
            const IconComponent = button.icon
            const useStroke = button.id === 'wifi' || button.id === 'airdrop'
            return (
              <LiquidButton
                key={button.id}
                variant="primary"
                size="xl"
                onClick={() => handleToggle(button.id)}
                rippleEffect={false}
                className="shadow-2xl w-24 h-24 !p-0 !rounded-full flex items-center justify-center m-2 transition-all duration-300"
                style={{
                  width: '96px',
                  height: '96px',
                  padding: '0',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '8px',
                  background: button.active
                    ? button.activeBackground
                    : undefined,
                  borderColor: button.active ? button.activeBorder : undefined,
                }}
              >
                <IconComponent
                  className="pointer-events-none"
                  size={40}
                  color="white"
                  fill={useStroke ? 'none' : 'white'}
                  strokeWidth={useStroke ? 2 : 0}
                />
              </LiquidButton>
            )
          })}
        </div>
      </LiquidGlass>
    </div>
  )
}
