# Emotive HUD

Emotive HUD is a [Foundry VTT](https://foundryvtt.com) module that brings stories to life with a dynamic character portrait interface. Lets players express their characters' emotions and reactions in real-time.

## Features

### Dynamic Portrait HUD

- Right-click on a character portrait in the HUD to open the expression picker
- Easily switch between different character portraits during gameplay

### Chat Integration

- Use `/say [message]` to send a chat message with your current expression
- Messages will include both your text and current portrait
- Compatible with [Chat Commander](https://foundryvtt.com/packages/_chatcommands/)

### Flexible Layout

- Each player can customize their view with adjustable grid columns and choice of embedded chat or floating window display to match their screen setup
- Minimizable interface 

## Configuration

### Portrait Requirements

- Supported image formats: JPG, JPEG, PNG, WEBP
- All portraits for a character should be in the same folder
- Consistent image dimensions, ideally square portraits, recommended for best results

### Setting Up the HUD

- GMs can customize who shows up on the hud at any time, Click the menu icon (≡) in the Emotive HUD
- Drag actors into the configuration window
- Select a folder containing portrait images for each actor
- Click Apply to save changes

### Basic Controls

- **Toggle HUD**: Click the chevron icon (▼/▲) to minimize/maximize the HUD
- **Reset Portrait**: Click "Reset to Default" in the expression picker to return to the default portrait

### Module Settings
- **Actor Limit (World)**: Maximum number of actors that can be added to the HUD (default: 15)
- **Grid Columns (Local)**: Number of columns in the portrait grid (default: 3)
- **HUD Layout (Local)**: Choose between `Embedded in Chat` or `Floating Window`

## Permissions

- **GM**: Full access to all features, including HUD configuration
- **Players**: Can change expressions for owned characters and use chat integration

## Technical Notes

- Portrait changes only affect the Emotive HUD display and `/say` messages - they do not modify the actor's default portrait in the character sheet
- The module uses WebSocket communication to sync portrait changes across clients

## Development Setup

Install FoundryVTT locally, then create an `.env` file in the project root directory with your desired Foundry module path like this:

`FOUNDRY_VTT_PATH="path/to/your/foundry/data/modules/emotive-hud"`

This will allow you to use `npm run dev` to have a hot reloading development enviroment.

## Acknowledgments
Used Code Snippets From
- https://github.com/MemelyPepeartly/pf2e-typescript-content-pack-template
- https://github.com/Lazrius/FoundryVTT-Typescript-Module-Template
