import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { ScatterplotLayer } from '@deck.gl/layers';
import { DataFilterExtension } from '@deck.gl/extensions';
import 'maplibre-gl/dist/maplibre-gl.css'; 

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const TIME_WINDOW_DAYS = 7; 
const INITIAL_VIEW_STATE = {
  longitude: -62.0, 
  latitude: 45.0,
  zoom: 5.5, 
  pitch: 0,
  bearing: 0,
};

const dataFilterExtension = new DataFilterExtension({
  filterSize: 1, 
  countItems: true
});


const convertIndexToDateRange = (timeIndex, startDateString) => {
    if (!startDateString) return 'Loading Dates...';
    
    const start = new Date(startDateString);
    const integerDay = Math.floor(timeIndex);
    start.setDate(start.getDate() + integerDay);

    const end = new Date(start);
    end.setDate(end.getDate() + TIME_WINDOW_DAYS - 1); 

    const formatter = new Intl.DateTimeFormat('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    const startStr = formatter.format(start);
    const endStr = formatter.format(end);
    
    const hours = (timeIndex % 1) * 24;
    
    return `Week: ${startStr} - ${endStr} (Day ${integerDay - Math.floor(integerDay / 7) * 7 + 1} @ ${hours.toFixed(0)}h)`;
};

function PlaybackControls({ isPlaying, speed, setIsPlaying, setSpeed }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '10px'
        }}>
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ 
                    padding: '8px 12px', 
                    cursor: 'pointer', 
                    marginRight: '15px' 
                }}
            >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <label htmlFor="speed-slider" style={{ marginRight: '10px', whiteSpace: 'nowrap' }}>
                Speed ({speed.toFixed(1)}x):
            </label>
            <input
                id="speed-slider"
                type="range"
                min={0.1} 
                max={5.0} 
                step={0.1} 
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))} 
                style={{ width: '150px' }}
            />
        </div>
    );
}

function TimeSlider({ min, max, value, onChange, minDateString, isPlaying, speed, setIsPlaying, setSpeed }) {
    const dateRange = convertIndexToDateRange(value, minDateString);

    return (
        <div style={{ 
            position: 'absolute', 
            bottom: 20, 
            left: '50%', 
            transform: 'translateX(-50%)', 
            width: '80%', 
            maxWidth: '600px', 
            background: 'rgba(0,0,0,0.7)', 
            padding: '10px 20px', 
            borderRadius: '5px',
            color: 'white',
            zIndex: 1000 
        }}>
            <label htmlFor="time-slider" style={{ display: 'block', marginBottom: '5px' }}>
                Selected Time: 
                <span style={{ fontWeight: 'bold', marginLeft: '10px' }}>
                    {dateRange}
                </span>
            </label>
            <input
                id="time-slider"
                type="range"
                min={min} 
                max={max} 
                step={1 / 3.0} 
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))} 
                style={{ width: '100%' }}
            />
            <PlaybackControls 
                isPlaying={isPlaying} 
                speed={speed} 
                setIsPlaying={setIsPlaying} 
                setSpeed={setSpeed}
            />
        </div>
    );
}


export default function TurtleMap({ 
    csvUrl = '/predicted_turtle_data.csv',
    metadataUrl = '/turtle_metadata.json' 
}) {
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const [data, setData] = useState(null); 
    const [trendData, setTrendData] = useState(null); 
    const [maxTime, setMaxTime] = useState(0);
    const [minDate, setMinDate] = useState(null); 
    const [timeFilterStart, setTimeFilterStart] = useState(0.0); 
    const [filteredCount, setFilteredCount] = useState(0);

    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1.0);
    
    const speedRef = useRef(speed);
    const timeFilterRef = useRef(timeFilterStart);
    const maxTimeRef = useRef(maxTime);
    
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { timeFilterRef.current = timeFilterStart; }, [timeFilterStart]);
    useEffect(() => { maxTimeRef.current = maxTime; }, [maxTime]);
    

    const animate = useCallback(() => {
        //only run if playing
        if (!isPlaying) return;


        const FPS = 60;
        const STEP_PER_FRAME = speedRef.current / FPS;

        let newTime = timeFilterRef.current + STEP_PER_FRAME;

        if (newTime > maxTimeRef.current) {
            newTime = 0;
        }
        
        setTimeFilterStart(newTime);
        
        requestAnimationFrame(animate);
    }, [isPlaying]);


    useEffect(() => {
        if (isPlaying) {
            const animationFrame = requestAnimationFrame(animate);
            return () => cancelAnimationFrame(animationFrame);
        }
    }, [isPlaying, animate]);


    useEffect(() => {
        fetch(metadataUrl)
            .then(res => res.json())
            .then(meta => {
                setMinDate(meta.minDate);
                setMaxTime(meta.maxTimeIndex); 
                setTimeFilterStart(0.0); 
                
                return fetch(csvUrl);
            })
            .then(response => response.text())
            .then(text => {
                const rows = text.trim().split('\n').slice(1);
                const parsedData = rows.map(row => {
                    const [latitude, longitude, time_index, is_trend_str] = row.split(','); 
                    return { 
                        latitude: parseFloat(latitude), 
                        longitude: parseFloat(longitude), 
                        time_index: parseInt(time_index, 10), 
                        is_trend: is_trend_str.toLowerCase() === 'true'
                    };
                });
                
                const referenceDate = new Date(minDate);
                const cutoffDate = new Date('2015-01-01');
                const cutoffIndex = Math.floor((cutoffDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

                const filteredData = parsedData.filter(d => d.time_index >= cutoffIndex);

                const turtleData = filteredData.filter(d => !d.is_trend);
                const trendData = filteredData.filter(d => d.is_trend);

                setData(turtleData); 
                setTrendData(trendData); 
            })
            .catch(error => console.error("Could not load data or metadata:", error));
    }, [csvUrl, metadataUrl, minDate]);


    const layers = useMemo(() => {
        if (!data || !trendData) return [];
        
        const integerDay = Math.floor(timeFilterStart);
        
        const filterRange = [
            integerDay, 
            integerDay + TIME_WINDOW_DAYS 
        ];
        
        const OPACITY = 180;

        return [
            // 1. Predicted Trend Path
            new ScatterplotLayer({
                id: 'turtle-trend-path',
                data: trendData,
                getPosition: d => [d.longitude, d.latitude],
                getFillColor: [0, 255, 255, OPACITY], 
                getRadius: 150, 
                radiusScale: 50,
                pickable: false,

                extensions: [new DataFilterExtension({ filterSize: 1, countItems: true, soft: true })],
                getFilterValue: d => d.time_index,
                filterRange: filterRange,

                updateTriggers: {
                    getPosition: [timeFilterStart]
                },
                getPixelOffset: [0, 0],
            }),
            
            new ScatterplotLayer({
                id: 'turtle-locations-filtered',
                data: data,
                getPosition: d => [d.longitude, d.latitude],
                getFillColor: [255, 165, 0, OPACITY], 
                getRadius: 100,
                radiusScale: 50,
                pickable: true,
                
                extensions: [dataFilterExtension],
                getFilterValue: d => d.time_index, 
                filterRange: filterRange, 
                
                onFilteredItemsChange: ({ count }) => {
                    setFilteredCount(count);
                }
            })
        ];
    }, [data, trendData, timeFilterStart]);


    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <DeckGL
                viewState={viewState} 
                controller={true}
                layers={layers}
                onViewStateChange={({ viewState }) => setViewState(viewState)}
            >
                <Map
                    mapStyle={MAP_STYLE}
                    style={{ width: '100%', height: '100%' }}
                />
            </DeckGL>
            
            {data && trendData && minDate && (
                <>
                    <TimeSlider 
                        min={0} 
                        max={maxTime} 
                        value={timeFilterStart} 
                        onChange={setTimeFilterStart}
                        minDateString={minDate}
                        isPlaying={isPlaying}
                        speed={speed}
                        setIsPlaying={setIsPlaying}
                        setSpeed={setSpeed}
                    />
                    <div style={{ 
                        position: 'absolute', 
                        top: 10, 
                        left: 10, 
                        background: 'rgba(255, 255, 255, 0.8)', 
                        padding: '5px 10px', 
                        borderRadius: '5px',
                        zIndex: 1000
                    }}>
                        Points in Week: **{filteredCount}**
                    </div>
                </>
            )}
        </div>
    );
}