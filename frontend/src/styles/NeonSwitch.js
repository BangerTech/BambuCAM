import styled from '@emotion/styled';

const ToggleContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Label = styled.span`
  color: ${({ theme, active }) => 
    active 
      ? theme.palette.mode === 'dark' 
        ? '#00ffff' 
        : '#008080'
      : theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.5)'
        : 'rgba(0, 0, 0, 0.5)'
  };
  font-size: 0.9rem;
  font-weight: 500;
  text-shadow: ${({ theme, active }) => 
    active && theme.palette.mode === 'dark' 
      ? '0 0 10px rgba(0, 255, 255, 0.5)'
      : 'none'
  };
`;

const Toggle = styled.div`
  width: 50px;
  height: 25px;
  background: ${({ theme }) => 
    theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.1)'
  };
  border: 2px solid ${({ theme }) => 
    theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
  };
  border-radius: 25px;
  display: flex;
  align-items: center;
  padding: 2px;
  box-shadow: ${({ theme }) => 
    theme.palette.mode === 'dark'
      ? '0 0 10px #00ffff, 0 0 20px #00ffff'
      : '0 0 10px rgba(0, 128, 128, 0.3)'
  };
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  cursor: pointer;

  &.active {
    background: ${({ theme }) => 
      theme.palette.mode === 'dark' ? 'black' : 'white'
    };
    
    .knob {
      transform: translateX(25px);
      box-shadow: ${({ theme }) => 
        theme.palette.mode === 'dark'
          ? '0 0 10px #00ffff'
          : '0 0 10px rgba(0, 128, 128, 0.5)'
      };
      animation: bounce 0.3s ease-in-out;
    }
  }
`;

const Knob = styled.div`
  width: 20px;
  height: 20px;
  background: ${({ theme }) => 
    theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
  };
  border-radius: 50%;
  position: relative;
  z-index: 1;
  transition: transform 0.5s ease, box-shadow 0.3s ease;

  @keyframes bounce {
    50% {
      transform: translateX(25px) scale(1.1);
    }
  }
`;

export const NeonSwitch = ({ checked, onChange, theme }) => {
  return (
    <ToggleContainer>
      <Label active={!checked}>LAN</Label>
      <Toggle 
        className={checked ? 'active' : ''} 
        onClick={() => onChange({ target: { checked: !checked }})}
      >
        <Knob />
      </Toggle>
      <Label active={checked}>CLOUD</Label>
    </ToggleContainer>
  );
}; 